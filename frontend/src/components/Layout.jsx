// src/components/Layout.jsx
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import GraphView from './GraphView';
import ChatWindow from './ChatWindow';
import NodeInfoPanel from './NodeInfoPanel';

export default function Layout() {
  return (
    <div className="h-full p-3">
      <PanelGroup direction="horizontal" className="h-full">
        {/* 左側：圖譜區 */}
        <Panel defaultSize={55} minSize={35}>
          <div className="glass-panel w-full h-full overflow-hidden relative">
            <GraphView />
          </div>
        </Panel>

        <PanelResizeHandle className="resize-handle-h" />

        {/* 右側：控制面板 */}
        <Panel defaultSize={45} minSize={22}>
          <div className="flex flex-col gap-3 h-full">
            {/* 聊天室 + 節點資訊（可調整高度） */}
            <div className="flex-1 min-h-0">
              <PanelGroup direction="vertical" className="h-full">
                <Panel defaultSize={58} minSize={30}>
                  <div className="glass-panel flex flex-col overflow-hidden h-full">
                    <ChatWindow />
                  </div>
                </Panel>

                <PanelResizeHandle className="resize-handle-v" />

                <Panel defaultSize={42} minSize={20}>
                  <div className="glass-panel overflow-auto h-full">
                    <NodeInfoPanel />
                  </div>
                </Panel>
              </PanelGroup>
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
