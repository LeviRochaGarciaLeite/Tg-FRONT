import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Dados fictícios para o seu TG - Monitoramento de Colheita/Produção
const data = [
  { dia: 'Seg', produtividade: 85 },
  { dia: 'Ter', produtividade: 92 },
  { dia: 'Qua', produtividade: 78 },
  { dia: 'Qui', produtividade: 95 },
  { dia: 'Sex', produtividade: 88 },
];

const ProductivityChart = () => {
  return (
    <div style={{ width: '100%', height: 300, marginTop: '20px' }}>
      <h3>Índice de Produtividade Diária (Foco TG)</h3>
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="dia" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="produtividade" radius={[5, 5, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.produtividade > 80 ? '#4CAF50' : '#FF9800'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ProductivityChart;