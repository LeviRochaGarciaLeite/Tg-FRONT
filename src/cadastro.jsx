import { useState } from "react";
import axios from "axios";
import LogoNexus from "./assets/logo-nexus.svg";

const API_BASE = "http://127.0.0.1:5000/api";

function formatCpf(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function Cadastro({ onGoLogin }) {
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Validação em tempo real
  const cpfDigits = cpf.replace(/\D/g, "");
  const senhaMatch = senha && confirmarSenha && senha === confirmarSenha;
  const senhaNoMatch = confirmarSenha && senha !== confirmarSenha;

  async function handleCadastro(e) {
    e.preventDefault();
    setError("");

    if (cpfDigits.length < 11) {
      setError("Informe um CPF válido com 11 dígitos.");
      return;
    }

    if (senha.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (senha !== confirmarSenha) {
      setError("As senhas não coincidem.");
      return;
    }

    try {
      setLoading(true);

      await axios.post(`${API_BASE}/auth/cadastro`, {
        cpf: cpfDigits,
        senha,
        confirmar_senha: confirmarSenha,
      });

      setSuccess(true);
      // Redireciona para login após 2 segundos
      setTimeout(() => onGoLogin(), 2000);
    } catch (err) {
      const msg =
        err?.response?.data?.erro ||
        (err?.response?.status === 409
          ? "CPF já cadastrado."
          : "Erro ao cadastrar. Tente novamente.");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrapper">
      <img src={LogoNexus} alt="Logo Nexus" className="logo-icon-outside" />

      <div className="login-card">
        <h1>CADASTRO</h1>
        <p className="login-subtitle">Crie seu acesso ao portal Nexus</p>

        {success ? (
          <div className="cadastro-success">
            <span className="cadastro-success__icon">✔</span>
            <p>Conta criada com sucesso!</p>
            <p className="cadastro-success__sub">Redirecionando para o login…</p>
          </div>
        ) : (
          <form onSubmit={handleCadastro} className="login-form" noValidate>
            <div className="input-group">
              <input
                type="text"
                placeholder="CPF"
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                inputMode="numeric"
                autoComplete="username"
                required
                aria-label="CPF"
              />
              {cpfDigits.length > 0 && cpfDigits.length < 11 && (
                <span className="input-hint">
                  {11 - cpfDigits.length} dígito(s) restante(s)
                </span>
              )}
            </div>

            <div className="input-group">
              <input
                type="password"
                placeholder="SENHA"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="new-password"
                required
                aria-label="Senha"
              />
            </div>

            <div className="input-group">
              <input
                type="password"
                placeholder="CONFIRMAR SENHA"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                autoComplete="new-password"
                required
                aria-label="Confirmar senha"
                className={
                  senhaNoMatch
                    ? "input--error"
                    : senhaMatch
                    ? "input--ok"
                    : ""
                }
              />
              {senhaNoMatch && (
                <span className="input-hint input-hint--error">
                  As senhas não coincidem
                </span>
              )}
              {senhaMatch && (
                <span className="input-hint input-hint--ok">✔ Senhas conferem</span>
              )}
            </div>

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="login-button"
              disabled={loading || senhaNoMatch}
            >
              {loading ? (
                <span className="btn-loading">
                  <span className="spinner" />
                  CADASTRANDO…
                </span>
              ) : (
                "CADASTRAR"
              )}
            </button>
          </form>
        )}

        <div className="login-footer login-footer-center">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onGoLogin();
            }}
          >
            VOLTAR PARA LOGIN
          </a>
        </div>
      </div>
    </div>
  );
}

export default Cadastro;
