import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Button } from "./button";
import { Card } from "./card";
import { Download } from "lucide-react";

interface CodeEditorProps {
  code: string;
  className?: string;
}

export function CodeEditor({ code, className }: CodeEditorProps) {
  const downloadCode = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "smart-contract.rs";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <Card className={className}>
      <div className="p-4 bg-zinc-900 rounded-t-lg flex justify-between items-center">
        <span className="text-zinc-400">Solana Smart Contract</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={downloadCode}
          className="hover:bg-zinc-800"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
      <SyntaxHighlighter
        language="rust"
        style={atomDark}
        customStyle={{
          margin: 0,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
        }}
      >
        {code}
      </SyntaxHighlighter>
    </Card>
  );
}
