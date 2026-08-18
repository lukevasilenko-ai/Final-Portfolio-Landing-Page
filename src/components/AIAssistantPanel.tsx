import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Bot,
  LoaderCircle,
  RotateCcw,
  Send,
  Sparkles,
  X
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  buildAssistantPrompt,
  buildStrictLanguageRetryPrompt,
  detectAssistantLanguage,
  getDirectKnowledgeAnswer,
  getBrowserAssistantLanguage,
  getOutOfScopeReply,
  isClearlyUnrelatedQuestion,
  isReplyInExpectedLanguage,
  type AssistantLanguage,
  type AssistantPromptMessage
} from '../ai/assistantPrompt';
import {
  loadAssistantRuntime,
  UnsupportedAssistantError,
  type AssistantRuntime
} from '../ai/assistantRuntime';

interface AIAssistantPanelProps {
  open: boolean;
  onClose: () => void;
}

type RuntimeStatus = 'loading' | 'ready' | 'unsupported' | 'error';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const COPY = {
  ka: {
    initial: 'გამარჯობა 👋 მე ვარ AI ასისტენტი. შეგიძლია მკითხო გრაფიკული დიზაინის ან ჩემი სერვისების შესახებ.',
    suggestions: [
      'რა სერვისებს მთავაზობ?',
      'რა ღირს სოციალური მედიის დიზაინი?',
      'როგორ შეგიკვეთო დიზაინი?'
    ],
    placeholder: 'დაწერეთ შეკითხვა...',
    send: 'შეკითხვის გაგზავნა',
    close: 'AI ასისტენტის დახურვა',
    loading: 'AI მოდელი მზადდება ამ მოწყობილობაზე',
    loadingNote: 'პირველი ჩატვირთვა შეიძლება რამდენიმე წუთი გაგრძელდეს. შემდეგ მოდელი browser cache-იდან გაიხსნება.',
    starting: 'ასისტენტი იწყება...',
    ready: 'მზადაა',
    generating: 'პასუხობს',
    error: 'ასისტენტის ჩატვირთვა ვერ მოხერხდა. შეამოწმეთ კავშირი და სცადეთ თავიდან.',
    retry: 'თავიდან ცდა',
    responseError: 'პასუხის შექმნა ვერ მოხერხდა. გთხოვთ, კიდევ ერთხელ სცადოთ.'
  },
  en: {
    initial: 'Hello 👋 I’m the AI Assistant. You can ask me about graphic design or my services.',
    suggestions: [
      'What services do you offer?',
      'How much does social media design cost?',
      'How can I order a design?'
    ],
    placeholder: 'Ask a question...',
    send: 'Send question',
    close: 'Close AI Assistant',
    loading: 'Preparing the AI model on this device',
    loadingNote: 'The first load may take a few minutes. After that, the model opens from the browser cache.',
    starting: 'Starting the assistant...',
    ready: 'Ready',
    generating: 'Responding',
    error: 'The assistant could not load. Check your connection and try again.',
    retry: 'Try again',
    responseError: 'The response could not be generated. Please try again.'
  }
} as const;

const cleanModelReply = (value: string) =>
  value
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^\s*<\/think>\s*/i, '')
    .trim();

export default function AIAssistantPanel({ open, onClose }: AIAssistantPanelProps) {
  const [language] = useState<AssistantLanguage>(getBrowserAssistantLanguage);
  const copy = COPY[language];
  const [status, setStatus] = useState<RuntimeStatus>('loading');
  const [progress, setProgress] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'initial', role: 'assistant', content: copy.initial }
  ]);
  const runtimeRef = useRef<AssistantRuntime | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  const progressPercent = Math.min(100, Math.max(0, Math.round(progress * 100)));
  const statusLabel = isGenerating ? copy.generating : status === 'ready' ? copy.ready : copy.loading;
  const showSuggestions = messages.length === 1 && !isGenerating;

  useEffect(() => {
    let active = true;

    setStatus('loading');
    setProgress(0);

    loadAssistantRuntime((report) => {
      if (active) setProgress(report.progress);
    })
      .then((runtime) => {
        if (!active) return;
        runtimeRef.current = runtime;
        setProgress(1);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setStatus(error instanceof UnsupportedAssistantError ? 'unsupported' : 'error');
      });

    return () => {
      active = false;
    };
  }, [retryKey]);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleEscape);
    const focusTarget = status === 'ready' ? inputRef.current : closeRef.current;
    window.requestAnimationFrame(() => focusTarget?.focus());

    const mobile = window.matchMedia('(max-width: 640px)').matches;
    const previousOverflow = document.body.style.overflow;
    if (mobile) document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleEscape);
      if (mobile) document.body.style.overflow = previousOverflow;
    };
  }, [onClose, open, status]);

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [isGenerating, messages, open]);

  const conversation = useMemo<AssistantPromptMessage[]>(
    () => messages
      .filter((message) => message.id !== 'initial')
      .map(({ role, content }) => ({ role, content })),
    [messages]
  );

  const sendMessage = async (rawQuestion: string) => {
    const question = rawQuestion.trim();
    const runtime = runtimeRef.current;

    if (!question || !runtime || status !== 'ready' || isGenerating) return;

    const questionLanguage = detectAssistantLanguage(question, language);
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question
    };
    const assistantId = `assistant-${Date.now()}`;
    const nextConversation: AssistantPromptMessage[] = [
      ...conversation,
      { role: 'user', content: question }
    ];

    setInput('');
    setMessages((current) => [...current, userMessage]);

    if (isClearlyUnrelatedQuestion(question)) {
      setMessages((current) => [
        ...current,
        { id: assistantId, role: 'assistant', content: getOutOfScopeReply(questionLanguage) }
      ]);
      return;
    }

    const directAnswer = getDirectKnowledgeAnswer(question, questionLanguage);

    if (directAnswer) {
      setIsGenerating(true);
      setMessages((current) => [
        ...current,
        { id: assistantId, role: 'assistant', content: '' }
      ]);
      await new Promise((resolve) => window.setTimeout(resolve, 260));
      setMessages((current) => current.map((message) =>
        message.id === assistantId ? { ...message, content: directAnswer } : message
      ));
      setIsGenerating(false);
      return;
    }

    setIsGenerating(true);
    setMessages((current) => [
      ...current,
      { id: assistantId, role: 'assistant', content: '' }
    ]);
    const requestId = ++requestIdRef.current;

    try {
      const prompt = buildAssistantPrompt(nextConversation, questionLanguage);
      let reply = await runtime.streamReply(prompt, (partialReply) => {
        if (requestIdRef.current !== requestId) return;
        const cleanedReply = cleanModelReply(partialReply);
        if (questionLanguage === 'ka' && !isReplyInExpectedLanguage(cleanedReply, questionLanguage)) {
          return;
        }
        setMessages((current) => current.map((message) =>
          message.id === assistantId ? { ...message, content: cleanedReply } : message
        ));
      });
      let cleanedReply = cleanModelReply(reply);

      if (!isReplyInExpectedLanguage(cleanedReply, questionLanguage)) {
        const retryPrompt = buildStrictLanguageRetryPrompt(question, questionLanguage);
        reply = await runtime.streamReply(retryPrompt, (partialReply) => {
          if (requestIdRef.current !== requestId) return;
          const cleanedPartial = cleanModelReply(partialReply);
          if (!isReplyInExpectedLanguage(cleanedPartial, questionLanguage)) return;
          setMessages((current) => current.map((message) =>
            message.id === assistantId ? { ...message, content: cleanedPartial } : message
          ));
        });
        cleanedReply = cleanModelReply(reply);
      }

      setMessages((current) => current.map((message) =>
        message.id === assistantId
          ? {
              ...message,
              content: isReplyInExpectedLanguage(cleanedReply, questionLanguage)
                ? cleanedReply
                : COPY[questionLanguage].responseError
            }
          : message
      ));
    } catch {
      setMessages((current) => current.map((message) =>
        message.id === assistantId
          ? { ...message, content: COPY[questionLanguage].responseError }
          : message
      ));
    } finally {
      if (requestIdRef.current === requestId) setIsGenerating(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label={copy.close}
            className="ai-assistant-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.section
            id="ai-assistant-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-assistant-title"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="ai-assistant-panel"
          >
            <header className="ai-assistant-header">
              <div className="flex min-w-0 items-center gap-3">
                <span className="ai-assistant-avatar">
                  <Bot className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 id="ai-assistant-title" className="truncate text-sm font-bold text-[var(--brand-ink)]">
                    AI Assistant
                  </h2>
                  <span className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--brand-muted)]">
                    <span className={`ai-assistant-status-dot is-${status}`} />
                    {statusLabel}
                  </span>
                </div>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                className="icon-button h-9 w-9 shrink-0"
                aria-label={copy.close}
                title={copy.close}
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="ai-assistant-messages" role="log" aria-live="polite" aria-busy={isGenerating}>
              {messages.map((message) => (
                <div key={message.id} className={`ai-assistant-message is-${message.role}`}>
                  {message.role === 'assistant' && (
                    <span className="ai-assistant-message-icon" aria-hidden="true">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <div className="ai-assistant-bubble">
                    {message.content || (
                      <span className="ai-assistant-typing" aria-label={copy.generating}>
                        <span />
                        <span />
                        <span />
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {status === 'loading' && (
                <div className="ai-assistant-loader" role="status">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-2 text-xs font-semibold text-[var(--brand-ink)]">
                      <LoaderCircle className="h-4 w-4 animate-spin text-[var(--brand-accent)]" />
                      {progressPercent >= 99 ? copy.starting : copy.loading}
                    </span>
                    <span className="font-mono text-[10px] font-bold text-[var(--brand-accent)]">
                      {progressPercent}%
                    </span>
                  </div>
                  <div className="ai-assistant-progress" aria-hidden="true">
                    <span style={{ transform: `scaleX(${progressPercent / 100})` }} />
                  </div>
                  <p>{copy.loadingNote}</p>
                </div>
              )}

              {status === 'unsupported' && (
                <div className="ai-assistant-notice is-warning" role="status">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p>AI Assistant is not supported on this device or browser yet.</p>
                </div>
              )}

              {status === 'error' && (
                <div className="ai-assistant-notice is-error" role="alert">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
                    <p>{copy.error}</p>
                    <button
                      type="button"
                      className="button-secondary min-h-9 px-3 text-xs"
                      onClick={() => setRetryKey((value) => value + 1)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {copy.retry}
                    </button>
                  </div>
                </div>
              )}

              {showSuggestions && status === 'ready' && (
                <div className="ai-assistant-suggestions" aria-label="Suggested questions">
                  {copy.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void sendMessage(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form className="ai-assistant-composer" onSubmit={handleSubmit}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={copy.placeholder}
                rows={1}
                maxLength={500}
                disabled={status !== 'ready' || isGenerating}
                aria-label={copy.placeholder}
              />
              <button
                type="submit"
                className="ai-assistant-send"
                disabled={!input.trim() || status !== 'ready' || isGenerating}
                aria-label={copy.send}
                title={copy.send}
              >
                {isGenerating
                  ? <LoaderCircle className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />}
              </button>
            </form>
          </motion.section>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
