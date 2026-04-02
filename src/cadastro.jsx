import { useState } from "react";
import axios from "axios";
import LogoNexus from "./assets/logo-nexus.svg";

function Cadastro({ onGoLogin }) {
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCadastro(e) {
    e.preventDefault();

    if (senha !== confirmarSenha) {
      alert("As senhas não coincidem.");
      return;
    }

    if (cpf.length < 11) {
      alert("Informe um CPF válido.");
      return;
    }

    try {
      setLoading(true);

      await axios.post("http://127.0.0.1:5000/api/auth/cadastro", {
        cpf,
        senha,
        confirmar_senha: confirmarSenha,
      });

      alert("Cadastro realizado com sucesso!");
      onGoLogin();
    } catch (error) {
      console.error(error);
      alert(
        error?.response?.data?.erro || "Erro ao cadastrar usuário."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrapper">
      <img src={LogoNexus} alt="Logo" className="logo-icon-outside" />

      <div className="login-card">
        <h1>CADASTRO</h1>
        <p className="login-subtitle">Crie seu acesso ao portal Nexus</p>

        <form onSubmit={handleCadastro} className="login-form">
          <div className="input-group">
            <input
              type="text"
              placeholder="CPF"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <input
              type="password"
              placeholder="SENHA"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <input
              type="password"
              placeholder="CONFIRMAR SENHA"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? "CADASTRANDO..." : "CADASTRAR"}
          </button>
        </form>

        <div className="login-footer login-footer-center">
          <a href="#" onClick={(e) => {
            e.preventDefault();
            onGoLogin();
          }}>
            VOLTAR PARA LOGIN
          </a>
        </div>
      </div>
    </div>
  );
}

export default Cadastro;