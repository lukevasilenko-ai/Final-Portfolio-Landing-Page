import { createContext, useContext, type ReactNode } from 'react';

export type WebsiteEditorSelection = {
  kind: 'native' | 'block' | 'section';
  sectionId: string;
  targetId?: string;
  blockId?: string;
  label: string;
  fields: string[];
};

type EditorRuntime = {
  enabled: boolean;
};

const WebsiteEditorRuntimeContext = createContext<EditorRuntime>({ enabled: false });

export function WebsiteEditorRuntimeProvider({ enabled, children }: EditorRuntime & { children: ReactNode }) {
  return <WebsiteEditorRuntimeContext.Provider value={{ enabled }}>{children}</WebsiteEditorRuntimeContext.Provider>;
}

export function useWebsiteEditorRuntime() {
  return useContext(WebsiteEditorRuntimeContext);
}
