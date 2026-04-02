import React from "react";


export default function Inicia() {
  return (
    <>
      <header className="topbar">
        <div className="topbar__logo">
          <img src="/logo-nexus.svg" alt="Logo Nexus" />
        </div>

        <nav className="topbar__nav">
          <a href="#" className="active">MEU RELÓGIO</a>
          <a href="#">HISTORICO</a>
          <a href="#">HOLERITE</a>
          <a href="#">MINHA EQUIPE</a>
          <a href="#">RANKING</a>
          <a href="#">GESTÃO</a>
        </nav>

        <div className="topbar__user"></div>
      </header>

      <main className="hero">
        <section className="hero-card">
          <img src="/logo-nexus.svg" alt="Nexus" className="hero-card__logo" />

          <a href="/ponto-eletronico" className="hero-card__button">
            INICIAR JORNADA
          </a>
        </section>
      </main>
    </>
  );
}