import { useState, useEffect } from 'react'
import axios from 'axios'
import ProductivityChart from './ProductivityChart';
import './App.css';

import LogoNexus from './assets/logo-nexus.svg';

function App() {
  // --- ESTADOS DE LOGIN E NAVEGAÇÃO ---
  const [isLogged, setIsLogged] = useState(false)
  const [userData, setUserData] = useState({ nome: '', perfil: '' })
  const [cpf, setCpf] = useState('')
  const [senha, setSenha] = useState('')
  const [abaAtiva, setAbaAtiva] = useState('ponto')
  const [equipe, setEquipe] = useState([])
  const [pendencias, setPendencias] = useState([])

  // --- ESTADOS DO CRONÔMETRO ---
  const [segundos, setSegundos] = useState(0);
  const [ativo, setAtivo] = useState(false);
  const [pausado, setPausado] = useState(false);

  // --- ESTADOS DOS HORÁRIOS E PAUSAS (CORRIGIDO: Adicionado os que faltavam) ---
  const [horaInicio, setHoraInicio] = useState("--:--");
  const [horaFim, setHoraFim] = useState("--:--");
  const [listaPausas, setListaPausas] = useState([]); 

  // Lógica do Cronômetro
  useEffect(() => {
    let intervalo = null;
    if (ativo && !pausado) {
      intervalo = setInterval(() => {
        setSegundos((s) => s + 1);
      }, 1000);
    } else {
      clearInterval(intervalo);
    }
    return () => clearInterval(intervalo);
  }, [ativo, pausado]);

  const formatarTempo = (total) => {
    const h = Math.floor(total / 3600).toString().padStart(2, '0');
    const m = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
    const s = (total % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const registrarNoBanco = async (tipo) => {
    try {
      const token = localStorage.getItem('nexus_token');
      await axios.post('http://127.0.0.1:5000/api/ponto/registrar',
        { tipo_registro: tipo },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (e) { console.error("Erro no registro:", e); }
  };

  const handleAcaoPrincipal = async () => {
    const agora = new Date().toLocaleTimeString('pt-BR');

    if (!ativo) {
      // INICIAR JORNADA
      setHoraInicio(agora);
      setHoraFim("--:--"); // Limpa o fim se estiver reiniciando
      setListaPausas([]);  // Limpa as pausas do dia anterior
      await registrarNoBanco('entrada');
      setAtivo(true);
      setPausado(false);
    } else {
      // ALTERNAR PAUSA
      if (!pausado) {
        // Começou uma pausa: cria um novo objeto usando 'inicio' para bater com o JSX
        setListaPausas([...listaPausas, { inicio: agora, fim: "--:--" }]);
        await registrarNoBanco('pausa_inicio');
      } else {
        // Retomou da pausa: atualiza o 'fim' do último item
        const novasPausas = [...listaPausas];
        novasPausas[novasPausas.length - 1].fim = agora;
        setListaPausas(novasPausas);
        await registrarNoBanco('pausa_fim');
      }
      setPausado(!pausado);
    }
  };

  const handleFinalizarDia = async () => {
    if (window.confirm("Deseja finalizar o expediente?")) {
      const agora = new Date().toLocaleTimeString('pt-BR');
      
      // 1. Regista o horário no campo FIM para o utilizador visualizar
      setHoraFim(agora); 
      
      // 2. Envia a informação para o banco de dados
      await registrarNoBanco('saida');
      
      // 3. Desativa o cronómetro e ZERA O CONTADOR
      setAtivo(false);
      setPausado(false);
      setSegundos(0); // <--- Esta linha faz o relógio voltar a 00:00:00
    }
  };

  // --- LOGIN E LOGOUT ---
  useEffect(() => {
    const token = localStorage.getItem('nexus_token');
    const nome = localStorage.getItem('nexus_nome');
    const perfil = localStorage.getItem('nexus_perfil');
    if (token && nome && perfil) {
      setUserData({ nome, perfil });
      setIsLogged(true);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault()
    try {
      const response = await axios.post('http://127.0.0.1:5000/api/auth/login', { cpf, senha })
      localStorage.setItem('nexus_token', response.data.token)
      localStorage.setItem('nexus_nome', response.data.nome)
      localStorage.setItem('nexus_perfil', response.data.perfil)
      setUserData({ nome: response.data.nome, perfil: response.data.perfil })
      setIsLogged(true)
    } catch (error) { alert("Dados inválidos"); }
  }

  const handleLogout = () => {
    localStorage.clear();
    setIsLogged(false);
  };

  if (!isLogged) {
    return (
      <div className="login-wrapper">
        <img src={LogoNexus} alt="Logo" className="logo-icon-outside" />
        <div className="login-card">
          <h1>LOGIN</h1>
          <p className="login-subtitle">Acesse o portal da equipe</p>
          <form onSubmit={handleLogin} className="login-form">
            <div className="input-group"><input type="text" placeholder="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} required /></div>
            <div className="input-group"><input type="password" placeholder="SENHA" value={senha} onChange={(e) => setSenha(e.target.value)} required /></div>
            <button type="submit" className="login-button">ENTRAR</button>
          </form>
          <div className="login-footer"><a>CRIAR CONTA</a><a>ESQUECI A SENHA</a></div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-layout">
      <nav className="navbar">
        <img src={LogoNexus} alt="Nexus" className="nav-logo" />
        <div className="nav-links">
          <button className={`nav-item nav-item-relogio ${abaAtiva === 'ponto' ? 'active' : ''}`} onClick={() => setAbaAtiva('ponto')}>MEU RELÓGIO</button>
          <button className="nav-item nav-item-historico">HISTORICO</button>
          <button className="nav-item nav-item-holerite">HOLERITE</button>
          <button className="nav-item nav-item-admin">MINHA EQUIPE</button>
          <button className="nav-item nav-item-relogio">RANKING</button>
          {userData.perfil !== 'colaborador' && <button className={`nav-item nav-item-gestao ${abaAtiva === 'gestao' ? 'active' : ''}`} onClick={() => setAbaAtiva('gestao')}>GESTÃO</button>}
        </div>
        <button className="nav-profile" onClick={handleLogout}></button>
      </nav>

      <div className="clock-panel-container">
        {abaAtiva === 'ponto' ? (
          <>
            <div className="clock-panel">
              <div className="time-log-section highlight-blue">
                <div className="log-row">
                  <span>INICIO</span>
                  <span>{horaInicio}</span>
                </div>

                <div className="pausa-table">
                  <span className="log-label" style={{ marginBottom: '10px', display: 'block' }}>PAUSA</span>
                  <div className="pausa-grid-header">
                    <span>ENTRADA</span>
                    <span>RETOMADA</span>
                  </div>

                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {listaPausas.length === 0 ? (
                      <div className="pausa-grid-row"><span>--:--</span><span>--:--</span></div>
                    ) : (
                      listaPausas.map((pausa, index) => (
                        <div className="pausa-grid-row" key={index}>
                          <span>{pausa.inicio}</span>
                          <span>{pausa.fim}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="log-row bottom">
                  <span>FIM</span>
                  <span>{horaFim}</span>
                </div>
              </div>

              <div className="clock-section">
                <span style={{ color: '#c0c8cc', letterSpacing: '2px' }}>TEMPO CONECTADO</span>
                <h1 className="main-time">{formatarTempo(segundos)}</h1>
                <div className="action-area" style={{ justifyContent: 'center' }}>
                  <div className="next-pause" style={{ textAlign: 'center' }}>
                    <p>PROXIMA PAUSA</p>
                    <span>em 02:30 HRS</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bottom-section">
              <div className="info-box"><span>TEMPO TRABALHADO</span><h4 className="text-blue">{formatarTempo(segundos)}</h4></div>
              <div className="info-box"><span>TEMPO PAUSAS</span><h4 className="text-dark">00:00:00</h4></div>
              <div className="action-group">
                <button className="btn-action btn-saida" onClick={handleFinalizarDia}>SAÍDA</button>
                <button
                  className="btn-action btn-pausa"
                  onClick={handleAcaoPrincipal}
                  style={{
                    backgroundColor: !ativo ? '#b38f00' : (pausado ? '#32cd32' : '#b38f00'),
                    minWidth: '180px'
                  }}
                >
                  {!ativo ? "INICIAR TRABALHO" : (pausado ? "RETOMAR" : "PAUSA")}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="clock-panel" style={{ color: 'white' }}><h2>Painel de Gestão</h2></div>
        )}
      </div>
    </div>
  )
}

export default App