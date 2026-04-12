// src/components/Layout.jsx
import GraphView from './GraphView';
import ChatWindow from './ChatWindow';
import NodeInfoPanel from './NodeInfoPanel';
import FileUpload from './FileUpload';
import ResetButton from './ResetButton';

export default function Layout() {
  return (
    <div className="h-full flex gap-3 p-3">
      {/* 左側：圖譜區 65% */}
      <div className="flex-[65] glass-panel overflow-hidden relative">
        <GraphView />
      </div>

      {/* 右側：控制面板 35% */}
      <div className="flex-[35] flex flex-col gap-3 min-w-[320px]">
        {/* 聊天室 */}
        <div className="flex-[55] glass-panel flex flex-col overflow-hidden">
          <ChatWindow />
        </div>

        {/* 節點資訊 */}
        <div className="flex-[35] glass-panel overflow-auto">
          <NodeInfoPanel />
        </div>

        {/* 工具列 */}
        <div className="flex-shrink-0 glass-panel p-3">
          <div className="flex gap-2 items-center">
            <FileUpload />
            <div className="flex-1" />
            <ResetButton />
          </div>
        </div>
      </div>
    </div>
  );
}
