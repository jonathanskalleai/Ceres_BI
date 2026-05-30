import { ListFilter } from "lucide-react";

const PipelineModule = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4">
        <ListFilter className="h-16 w-16 mx-auto text-muted-foreground/50" />
        <h1 className="text-2xl font-bold text-foreground">Pipeline</h1>
        <p className="text-muted-foreground">Em construção</p>
      </div>
    </div>
  );
};

export default PipelineModule;
