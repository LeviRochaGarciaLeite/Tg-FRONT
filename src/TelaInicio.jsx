import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Intro.css";

export default function Intro() {
  const navigate = useNavigate();

  useEffect(() => {
    const startTimer = setTimeout(() => {
      document.body.classList.add("started");
    }, 4500);

    const redirectTimer = setTimeout(() => {
      navigate("/login");
    }, 6000);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(redirectTimer);
      document.body.classList.remove("started");
    };
  }, [navigate]);

  return (
    <>
      <div className="bg-pulse"></div>
      <div className="bg-vignette"></div>
      <div className="scanlines"></div>

      <main className="intro" id="intro">
        <div className="flash"></div>

        <div className="logo-wrap" id="logoWrap">
          <div className="glow-ring"></div>
          <img src="/logo-nexus.svg" alt="Logo Nexus" className="logo" />
        </div>
      </main>
    </>
  );
}