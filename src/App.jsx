import { useState, useEffect } from 'react'
import axios from 'axios'
import ProductivityChart from './ProductivityChart';

function App() {
  const [isLogged, setIsLogged] = useState(false)
  const [userData, setUserData] = useState({ nome: '', perfil: '' })
  const [cpf, setCpf] = useState('')
  const [senha, setSenha] = useState('')
  const [abaAtiva, setAbaAtiva] = useState('ponto')
  const [equipe, setEquipe] = useState([])
  const [pendencias, setPendencias] = useState([])

  // PERSISTÊNCIA: Verifica se já existe um token ao abrir a página
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

      // Salva tudo no LocalStorage para não perder no F5
      localStorage.setItem('nexus_token', response.data.token)
      localStorage.setItem('nexus_nome', response.data.nome)
      localStorage.setItem('nexus_perfil', response.data.perfil)

      setUserData({ nome: response.data.nome, perfil: response.data.perfil })
      setIsLogged(true)
    } catch (error) {
      alert("Falha no login. Verifique os dados.")
    }
  }

  const handleLogout = () => {
    localStorage.clear(); // Limpa tudo
    setIsLogged(false);
    setUserData({ nome: '', perfil: '' });
  };

  // Carrega dados de gestão se for gestor
  useEffect(() => {
    if (isLogged && (userData.perfil === 'gestor' || userData.perfil === 'admin')) {
      const carregarDados = async () => {
        const token = localStorage.getItem('nexus_token');
        const headers = { Authorization: `Bearer ${token}` };
        try {
          const resEquipe = await axios.get('http://127.0.0.1:5000/api/gestor/equipe', { headers });
          const resPend = await axios.get('http://127.0.0.1:5000/api/gestor/pendencias', { headers });
          setEquipe(resEquipe.data.equipe);
          setPendencias(resPend.data.pendencias);
        } catch (e) { console.log("Erro ao carregar dados", e); }
      };
      carregarDados();
    }
  }, [isLogged, userData.perfil]);

  if (!isLogged) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#222', color: 'white' }}>
        <form onSubmit={handleLogin} style={{ background: '#333', padding: '30px', borderRadius: '10px' }}>
          <h2>Nexus Login</h2>
          <input type="text" placeholder="CPF" onChange={(e) => setCpf(e.target.value)} style={{ display: 'block', marginBottom: '10px', padding: '8px' }} />
          <input type="password" placeholder="Senha" onChange={(e) => setSenha(e.target.value)} style={{ display: 'block', marginBottom: '20px', padding: '8px' }} />
          <button type="submit" style={{ width: '100%', padding: '10px', background: '#007bff', border: 'none', color: 'white', cursor: 'pointer' }}>Entrar</button>
        </form>
      </div>
    )
  }

  return (
    <div style={{ padding: '30px', background: '#222', color: 'white', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h1>Nexus System - {userData.nome}</h1>
        <button onClick={handleLogout}>Sair</button>
      </div>

      <hr style={{ borderColor: '#444' }} />

      {/* SÓ APARECE SE FOR GESTOR OU ADMIN */}
      {(userData.perfil === 'gestor' || userData.perfil === 'admin') && (
        <div style={{ marginBottom: '20px' }}>
          <button onClick={() => setAbaAtiva('ponto')} style={{ marginRight: '10px', background: abaAtiva === 'ponto' ? '#555' : '#333', color: 'white', padding: '10px' }}>Meu Ponto</button>
          <button onClick={() => setAbaAtiva('gestao')} style={{ background: abaAtiva === 'gestao' ? '#555' : '#333', color: 'white', padding: '10px' }}>Gestão de Equipe</button>
        </div>
      )}

      {abaAtiva === 'ponto' ? (
        <div>
          <button style={{ padding: '15px 30px', background: 'green', color: 'white', border: 'none', marginRight: '10px' }}>ENTRADA</button>
          <button style={{ padding: '15px 30px', background: 'red', color: 'white', border: 'none' }}>SAÍDA</button>
          <div style={{ marginTop: '30px', background: '#333', padding: '20px', borderRadius: '10px' }}>
            <ProductivityChart />
          </div>
        </div>
      ) : (
        <div>
          <h3>Pendências ({pendencias.length})</h3>
          <ul>
            {pendencias.map(p => <li key={p.id_registro}>{p.colaborador} - {p.tipo_solicitado}</li>)}
          </ul>
          <h3>Equipe ({equipe.length})</h3>
          <ul>
            {equipe.map(m => <li key={m.id}>{m.nome} ({m.perfil})</li>)}
          </ul>
        </div>
      )}
      <p style={{ marginTop: '40px', color: '#888' }}>Sede: Pompéia - SP</p>
    </div>
  )
}

export default App