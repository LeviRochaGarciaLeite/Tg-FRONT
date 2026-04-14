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

function formatCelular(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.replace(/(\d{1,2})/, "($1");
  if (digits.length <= 7) return digits.replace(/(\d{2})(\d{1,5})/, "($1) $2");
  return digits.replace(/(\d{2})(\d{5})(\d{1,4})/, "($1) $2-$3");
}

function Cadastro({ onGoLogin }) {
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [cidade, setCidade] = useState("");
  const [celular, setCelular] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState("");

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
        data_nascimento: dataNascimento,
        cidade: cidade,
        celular: celular,
        email: email,
      });

      setSuccess(true);
      setTimeout(() => onGoLogin(), 2000);
    } catch (err) {
      const msg = err?.response?.data?.erro || (err?.response?.status === 409 ? "CPF já cadastrado." : "Erro ao cadastrar.");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrapper">
      <img src={LogoNexus} alt="Logo Nexus" className="logo-icon-outside" />

      <div className="login-card" style={{ maxWidth: '600px' }}>
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
              <input type="text" placeholder="CPF" value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} required />
            </div>

            <div className="input-group">
              <input
                type="email"
                placeholder="E-MAIL PESSOAL"
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>

            <div className="input-group" style={{ display: 'flex', gap: '10px' }}>
              <input type="text" placeholder="CIDADE" value={cidade} onChange={(e) => setCidade(e.target.value)} required style={{ flex: 1 }} />
              <input type="text" placeholder="CELULAR" value={celular} onChange={(e) => setCelular(formatCelular(e.target.value))} required style={{ flex: 1 }} />
            </div>

            <div className="input-group">
              <span className="input-hint" style={{ marginTop: 0, marginBottom: '4px', color: 'white' }}>Data de Nascimento</span>
              <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} required />
            </div>

            <div className="input-group" style={{ display: 'flex', gap: '10px' }}>
              <input type="password" placeholder="SENHA" value={senha} onChange={(e) => setSenha(e.target.value)} required style={{ flex: 1 }} />
              <input type="password" placeholder="CONFIRMAR SENHA" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} required className={senhaNoMatch ? "input--error" : senhaMatch ? "input--ok" : ""} style={{ flex: 1 }} />
            </div>
            
            {senhaNoMatch && <span className="input-hint input-hint--error">As senhas não coincidem</span>}

            {error && <div className="login-error" role="alert">{error}</div>}

            <button type="submit" className="login-button" disabled={loading || senhaNoMatch}>
              {loading ? "CADASTRANDO..." : "CADASTRAR"}
            </button>
          </form>
        )}

        <div className="login-footer login-footer-center">
          <a href="#" onClick={(e) => { e.preventDefault(); onGoLogin(); }}>VOLTAR PARA LOGIN</a>
        </div>
      </div>
    </div>
  );
}

export default Cadastro;