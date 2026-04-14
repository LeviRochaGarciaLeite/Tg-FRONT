import React, { useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function ResetPassword() {
  const [novaSenha, setNovaSenha]         = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [loading, setLoading]             = useState(false);
  const [sucesso, setSucesso]             = useState(false);
  const [erro, setErro]                   = useState("");

  // Pega o token da URL (ex: ?token=<token_seguro>)
  const query = new URLSearchParams(window.location.search);
  const token = query.get("token");

  if (!token) {
    return (
      <div className="login-wrapper">
        <div className="login-card">
          <h1>LINK INVÁLIDO</h1>
          <p className="login-subtitle">
            Este link de recuperação é inválido ou já foi utilizado.
          </p>
          <button className="login-button" onClick={() => (window.location.href = "/")}>
            Voltar ao Login
          </button>
        </div>
      </div>
    );
  }

  async function handleReset(e) {
    e.preventDefault();
    setErro("");

    if (novaSenha.length < 6) {
      setErro("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErro("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_BASE}/auth/reset-senha`, {
        token,
        nova_senha: novaSenha,
      });
      setSucesso(true);
      setTimeout(() => {
        window.location.href = "/";
      }, 3000);
    } catch (err) {
      const msg =
        err.response?.data?.erro ||
        "Erro ao redefinir senha. O link pode ter expirado.";
      setErro(msg);
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
          <div
            className="login-error"
            style={{ color: "#00f2ff", border: "1px solid #00f2ff" }}
          >
            ✅ Senha alterada! Redirecionando para o login...
          </div>
        ) : (
          <form onSubmit={handleReset} className="login-form">
            {erro && (
              <div className="login-error" style={{ marginBottom: "16px" }}>
                {erro}
              </div>
            )}

            <div className="input-group">
              <input
                type="password"
                placeholder="NOVA SENHA"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <div className="input-group">
              <input
                type="password"
                placeholder="CONFIRMAR NOVA SENHA"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                required
                minLength={6}
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
