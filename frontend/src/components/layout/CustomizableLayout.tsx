import React from 'react';
import { useLayoutConfig } from '../../hooks/useLayoutConfig';
import { AppSidebar } from './AppSidebar';

import { PanelContainer } from './PanelContainer';
import { DropZone } from './DropZone';
import { DragDropProvider } from './DragDropProvider';
import { ExtensionPanel } from '../panels/ExtensionPanel';
import { FileExplorer } from '../panels/FileExplorer';
import { Terminal } from '../panels/Terminal';
import { Output } from '../panels/Output';
import { Conversation, ProcessStatus } from '../../types';

interface CustomizableLayoutProps {
  conversations: Conversation[];
  activeConversation: string | null;
  processStatuses: ProcessStatus[];
  onConversationSelect: (id: string) => void;
  onKillProcess: (id: string) => void;
  onModelChange?: (model: string) => void;
  children: React.ReactNode;
}

export const CustomizableLayout: React.FC<CustomizableLayoutProps> = ({
  conversations,
  activeConversation,
  processStatuses,
  onConversationSelect,
  onKillProcess,
  onModelChange,
  children
}) => {
  const { layout, togglePanel, movePanel, pinPanel, minimizePanel, resizePanel } = useLayoutConfig();

  const leftPanels = layout.panels.filter(p => p.position === 'left' && p.visible);
  const rightPanels = layout.panels.filter(p => p.position === 'right' && p.visible);
  const bottomPanels = layout.panels.filter(p => p.position === 'bottom' && p.visible);
  const floatingPanels = layout.panels.filter(p => p.position === 'floating' && p.visible);

  const handleDrop = (panelId: string, zone: 'left' | 'right' | 'bottom' | 'center') => {
    if (zone === 'center') {
      movePanel(panelId, 'floating', { x: 200, y: 200 });
    } else {
      movePanel(panelId, zone);
    }
  };

  return (
    <DragDropProvider>
      <div className="flex h-screen relative">
        {/* Drop Zones */}
        <DropZone zone="left" onDrop={handleDrop} className="left-0 top-0 w-16 h-full" />
        <DropZone zone="right" onDrop={handleDrop} className="right-0 top-0 w-16 h-full" />
        <DropZone zone="bottom" onDrop={handleDrop} className="bottom-0 left-0 right-0 h-16" />
        <DropZone zone="center" onDrop={handleDrop} className="inset-16" />

        {/* Left Panels */}
        {leftPanels.length > 0 && (
          <div className="flex">
            {leftPanels.map(panel => (
              <PanelContainer
                key={panel.id}
                panel={panel}
                onMove={movePanel}
                onToggle={togglePanel}
                onPin={pinPanel}
                onMinimize={minimizePanel}
                onResize={resizePanel}
              >
                {panel.id === 'extensions' && <ExtensionPanel />}
                {panel.id === 'files' && <FileExplorer />}
              </PanelContainer>
            ))}
          </div>
        )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex">
          <main className="flex-1 bg-background">
            {children}
          </main>

          {/* Right Panels */}
          {rightPanels.length > 0 && (
            <div className="flex">
              {rightPanels.map(panel => (
                <PanelContainer
                  key={panel.id}
                  panel={panel}
                  onMove={movePanel}
                  onToggle={togglePanel}
                  onPin={pinPanel}
                  onMinimize={minimizePanel}
                  onResize={resizePanel}
                >
                  {panel.id === 'conversations' && (
                    <AppSidebar
                      conversations={conversations}
                      activeConversation={activeConversation}
                      processStatuses={processStatuses}
                      onConversationSelect={onConversationSelect}
                      onKillProcess={onKillProcess}
                      onModelChange={onModelChange}
                      open={true}
                      onOpenChange={() => {}}
                    >
                      <div />
                    </AppSidebar>
                  )}
                  {panel.id === 'extensions' && <ExtensionPanel />}
                  {panel.id === 'files' && <FileExplorer />}
                </PanelContainer>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Panels */}
        {bottomPanels.length > 0 && (
          <div className="flex border-t">
            {bottomPanels.map(panel => (
              <PanelContainer
                key={panel.id}
                panel={panel}
                onMove={movePanel}
                onToggle={togglePanel}
                onPin={pinPanel}
                onMinimize={minimizePanel}
                onResize={resizePanel}
              >
                {panel.id === 'terminal' && <Terminal />}
                {panel.id === 'output' && <Output />}
              </PanelContainer>
            ))}
          </div>
        )}
      </div>

      {/* Floating Panels */}
      {floatingPanels.map(panel => (
        <PanelContainer
          key={panel.id}
          panel={panel}
          onMove={movePanel}
          onToggle={togglePanel}
          onPin={pinPanel}
          onMinimize={minimizePanel}
          onResize={resizePanel}
        >
          {panel.id === 'conversations' && (
            <AppSidebar
              conversations={conversations}
              activeConversation={activeConversation}
              processStatuses={processStatuses}
              onConversationSelect={onConversationSelect}
              onKillProcess={onKillProcess}
              onModelChange={onModelChange}
              open={true}
              onOpenChange={() => {}}
            >
              <div />
            </AppSidebar>
          )}
          {panel.id === 'extensions' && <ExtensionPanel />}
          {panel.id === 'files' && <FileExplorer />}
          {panel.id === 'terminal' && <Terminal />}
          {panel.id === 'output' && <Output />}
        </PanelContainer>
      ))}
    </div>
    </DragDropProvider>
  );
};