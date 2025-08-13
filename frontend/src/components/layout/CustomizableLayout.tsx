import React from 'react';
import { useLayoutConfig } from '../../hooks/useLayoutConfig';
import { AppSidebar } from './AppSidebar';
import { SidebarInset } from '../ui/sidebar';
import { PanelContainer } from './PanelContainer';
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
  const { layout, togglePanel, movePanel } = useLayoutConfig();

  const leftPanels = layout.panels.filter(p => p.position === 'left' && p.visible);
  const rightPanels = layout.panels.filter(p => p.position === 'right' && p.visible);
  const bottomPanels = layout.panels.filter(p => p.position === 'bottom' && p.visible);

  return (
    <div className="flex h-screen">
      {/* Left Panels */}
      {leftPanels.length > 0 && (
        <div className="flex">
          {leftPanels.map(panel => (
            <PanelContainer
              key={panel.id}
              panel={panel}
              onMove={movePanel}
              onToggle={togglePanel}
            />
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex">
          <SidebarInset className="flex-1">
            {children}
          </SidebarInset>

          {/* Right Panels */}
          {rightPanels.length > 0 && (
            <div className="flex">
              {rightPanels.map(panel => (
                <PanelContainer
                  key={panel.id}
                  panel={panel}
                  onMove={movePanel}
                  onToggle={togglePanel}
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};