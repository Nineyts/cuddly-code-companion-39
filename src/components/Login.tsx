import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CHAVE = "usuario-nome-v1";

export function useUsuario() {
  const [nome, setNome] = useState("");
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    try {
      setNome(localStorage.getItem(CHAVE) ?? "");
    } catch {
      /* armazenamento indisponível */
    }
    setPronto(true);
  }, []);

  function entrar(valor: string) {
    setNome(valor);
    try {
      localStorage.setItem(CHAVE, valor);
    } catch {
      /* armazenamento indisponível */
    }
  }

  function sair() {
    setNome("");
    try {
      localStorage.removeItem(CHAVE);
    } catch {
      /* armazenamento indisponível */
    }
  }

  return { nome, pronto, entrar, sair };
}

export function Login({ onEntrar }: { onEntrar: (nome: string) => void }) {
  const [valor, setValor] = useState("");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Bem-vindo!</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const n = valor.trim();
              if (n) onEntrar(n);
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="nome">Seu nome</Label>
              <Input
                id="nome"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="Ex: Daniel"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={!valor.trim()}>
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
