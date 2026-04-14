import React, { useState } from "react";
import axios from "axios";

export default function ResetPassword() {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  // Pega o token da URL (ex: ?token=tk_1)
  const query = new URLSearchParams(window.location.search);
  const token = query.get("token");

  async function handleReset(e) {
    e.preventDefault();
    if (novaSenha !== confirmarSenha) {
      alert("As senhas não coincidem!");
      return;
    }

    setLoading(true);
    try {
      await axios.post("http://localhost:5000/api/auth/reset-senha", {
        token: token,
        nova_senha: novaSenha
      });
      setSucesso(true);
      setTimeout(() => {
        window.location.href = "/"; // Volta para o login
      }, 3000);
    } catch (err) {
      alert("Erro ao redefinir senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h1>NOVA SENHA</h1>
        <p className="login-subtitle">Crie uma senha forte para sua segurança</p>

        {sucesso ? (
          <div className="login-error" style={{ color: "#00f2ff", border: "1px solid #00f2ff" }}>
            Senha alterada! Redirecionando...
          </div>
        ) : (
          <form onSubmit={handleReset} className="login-form">
            <div className="input-group">
              <input
                type="password"
                placeholder="NOVA SENHA"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <input
                type="password"
                placeholder="CONFIRMAR NOVA SENHA"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="login-button" disabled={loading}>
              {loading ? "SALVANDO..." : "REDEFINIR SENHA"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}