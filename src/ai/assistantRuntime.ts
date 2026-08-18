import {
  CreateWebWorkerMLCEngine,
  type InitProgressReport,
  type WebWorkerMLCEngine
} from '@mlc-ai/web-llm';
import type { AssistantPromptMessage } from './assistantPrompt';

export const ASSISTANT_MODEL_ID = 'gemma3-1b-it-q4f16_1-MLC';

export class UnsupportedAssistantError extends Error {
  constructor() {
    super('AI Assistant is not supported on this device or browser yet.');
    this.name = 'UnsupportedAssistantError';
  }
}

interface GPUProvider {
  requestAdapter: () => Promise<unknown>;
}

interface NavigatorWithGPU extends Navigator {
  gpu?: GPUProvider;
}

export interface AssistantRuntime {
  streamReply: (
    messages: AssistantPromptMessage[],
    onToken: (fullText: string) => void
  ) => Promise<string>;
  interrupt: () => void;
}

const progressListeners = new Set<(report: InitProgressReport) => void>();
let sharedRuntimePromise: Promise<AssistantRuntime> | null = null;

export const hasWebGPUApi = (value: unknown = globalThis.navigator) => {
  if (!value || typeof value !== 'object') return false;
  const gpu = (value as NavigatorWithGPU).gpu;
  return Boolean(gpu && typeof gpu.requestAdapter === 'function');
};

const canUseWebGPU = async () => {
  if (!hasWebGPUApi()) return false;

  try {
    const gpu = (navigator as NavigatorWithGPU).gpu as GPUProvider;
    return Boolean(await gpu.requestAdapter());
  } catch {
    return false;
  }
};

const isDeviceCapabilityError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /webgpu|gpu|adapter|device lost|shader|storage buffer|out of memory/i.test(message);
};

const createRuntime = async (): Promise<AssistantRuntime> => {
  if (!(await canUseWebGPU())) {
    throw new UnsupportedAssistantError();
  }

  const worker = new Worker(new URL('../workers/aiAssistant.worker.ts', import.meta.url), {
    type: 'module',
    name: 'luka-imagines-ai'
  });

  let engine: WebWorkerMLCEngine;

  try {
    engine = await CreateWebWorkerMLCEngine(
      worker,
      ASSISTANT_MODEL_ID,
      {
        initProgressCallback: (report) => {
          console.info('[AI Assistant init]', report.progress, report.text);
          progressListeners.forEach((listener) => listener(report));
        },
        logLevel: 'WARN'
      },
      {
        context_window_size: 4096
      }
    );
  } catch (error) {
    console.error('[AI Assistant init error]', error);
    worker.terminate();
    if (isDeviceCapabilityError(error)) {
      throw new UnsupportedAssistantError();
    }
    throw error;
  }

  return {
    async streamReply(messages, onToken) {
      const chunks = await engine.chat.completions.create({
        messages,
        stream: true,
        max_tokens: 220,
        temperature: 0.35,
        top_p: 0.85,
        presence_penalty: 0.3,
        repetition_penalty: 1.05
      });

      let fullText = '';

      for await (const chunk of chunks) {
        fullText += chunk.choices[0]?.delta.content ?? '';
        onToken(fullText);
      }

      return fullText;
    },
    interrupt() {
      engine.interruptGenerate();
    }
  };
};

export const loadAssistantRuntime = async (
  onProgress: (report: InitProgressReport) => void
) => {
  progressListeners.add(onProgress);

  if (!sharedRuntimePromise) {
    sharedRuntimePromise = createRuntime().catch((error) => {
      sharedRuntimePromise = null;
      throw error;
    });
  }

  try {
    return await sharedRuntimePromise;
  } finally {
    progressListeners.delete(onProgress);
  }
};
