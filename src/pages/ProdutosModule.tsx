import { Package } from "lucide-react";

const ProdutosModule = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4">
        <Package className="h-16 w-16 mx-auto text-muted-foreground/50" />
        <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
        <p className="text-muted-foreground">Em construção</p>
      </div>
    </div>
  );
};

export default ProdutosModule;
