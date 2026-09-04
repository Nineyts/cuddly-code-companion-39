import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

const CHAVE = "tema";

export function BotaoTema() {
  const [escuro, setEscuro] = useState(false);

  useEffect(() => {
    const salvo = localStorage.getItem(CHAVE);
    const inicial =
      salvo === "escuro" ||
      (salvo === null && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setEscuro(inicial);
    document.documentElement.classList.toggle("dark", inicial);
  }, []);

  function alternar() {
    const novo = !escuro;
    setEscuro(novo);
    document.documentElement.classList.toggle("dark", novo);
    localStorage.setItem(CHAVE, novo ? "escuro" : "claro");
  }

  return (
    <Button variant="outline" size="sm" onClick={alternar}>
      {escuro ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
      {escuro ? "Modo claro" : "Modo escuro"}
    </Button>
  );
}
