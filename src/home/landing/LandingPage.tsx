import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const LandingPage: React.FC = () => {
    return (
        <div className="landing-container">
            <nav className="landing-nav">
                <div className="landing-logo">
                    Sum<span>App</span>
                </div>
                <Link to="/login" className="login-link">
                    Acceder al Sistema
                </Link>
            </nav>

            <header className="hero-section">
                <div className="hero-content">
                    <h1>Soluciones Integrales para tu Restaurante</h1>
                    <p>
                        Desde la gestión inteligente hasta el equipo de cocina más avanzado. 
                        Todo lo que necesitas para que tu negocio crezca sin límites.
                    </p>
                    <Link to="/login" className="hero-btn">
                        Comenzar Ahora
                    </Link>
                </div>
            </header>

            <section className="equipment-section">
                <div className="section-title">
                    <h2>Equipos para Restaurantes</h2>
                    <p>Contamos con la mejor tecnología gastronómica para potenciar tu cocina</p>
                </div>

                <div className="equipment-grid">
                    <div className="equipment-card">
                        <div className="card-icon">🍳</div>
                        <h3>Cocinas de Alta Gama</h3>
                        <p>Sistemas de cocción industrial con precisión térmica para los chefs más exigentes.</p>
                    </div>
                    <div className="equipment-card">
                        <div className="card-icon">❄️</div>
                        <h3>Refrigeración Pro</h3>
                        <p>Mantén tus insumos frescos por más tiempo con tecnología de conservación de punta.</p>
                    </div>
                    <div className="equipment-card">
                        <div className="card-icon">🤖</div>
                        <h3>Software de Gestión</h3>
                        <p>Control de inventario, ventas y personal en tiempo real desde cualquier dispositivo.</p>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default LandingPage;
