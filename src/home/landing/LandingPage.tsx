import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@apollo/client";
import {
    GET_ALL_COMPANIES,
    GET_COMPANIES_FOR_CARTA_DIGITAL,
} from "../../graphql/queries";
import "./LandingPage.css";

// Importar imágenes de banners
import banner1 from "../../assets/landing/banner1.png";
import banner2 from "../../assets/landing/banner2.png";
import banner3 from "../../assets/landing/banner3.png";

const banners = [
    {
        image: banner1,
        title: "Toma pedidos en la mesa sin errores y sin correr a la caja",
        btnText: "Ver App Móvil",
        link: "/login",
    },
    {
        image: banner2,
        title: "Los pedidos llegan solos a la cocina. Cero gritos, cero confusiones",
        btnText: "Ver Sistema de Cocina",
        link: "/login",
    },
    {
        image: banner3,
        title: "Controla ventas, inventario y cierres desde una sola pantalla",
        btnText: "Ver Software de Caja",
        link: "/login",
    },
];

const LandingPage: React.FC = () => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isScrolled, setIsScrolled] = useState(false);
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
    const [darkMode, setDarkMode] = useState(() => {
        return localStorage.getItem("sumaq-theme") === "dark";
    });

    const { data: companiesData } = useQuery(GET_ALL_COMPANIES);
    const { data: menuData } = useQuery(GET_COMPANIES_FOR_CARTA_DIGITAL);

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 50);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % banners.length);
        }, 8000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        localStorage.setItem("sumaq-theme", darkMode ? "dark" : "light");
    }, [darkMode]);

    const selectedCompany = useMemo(() => {
        if (!menuData || !selectedCompanyId) return null;
        return menuData.allCompanies.find(
            (c: any) => c.id === selectedCompanyId,
        );
    }, [menuData, selectedCompanyId]);

    useEffect(() => {
        if (menuData?.allCompanies?.length > 0 && !selectedCompanyId) {
            setSelectedCompanyId(menuData.allCompanies[0].id);
        }
    }, [menuData, selectedCompanyId]);

    return (
        <div className={`landing-container ${darkMode ? "dark-mode" : ""}`}>
            {/* Nav */}
            <nav className={`landing-nav ${isScrolled ? "scrolled" : ""}`}>
                <div className="landing-logo">
                    Sum<span>aq</span>
                </div>
                <div className="nav-actions">
                    <button
                        className="dark-mode-toggle"
                        onClick={() => setDarkMode(!darkMode)}
                    >
                        {darkMode ? "☀️" : "🌙"}
                    </button>
                    <Link to="/login" className="login-link">
                        ACCEDER
                    </Link>
                </div>
            </nav>

            {/* Banner */}
            <header className="banner-container">
                {banners.map((slide, index) => (
                    <div
                        key={index}
                        className={`banner-slide ${index === currentSlide ? "active" : ""}`}
                        style={{ backgroundImage: `url(${slide.image})` }}
                    >
                        <div className="banner-overlay" />
                        <div className="banner-content">
                            <h1>{slide.title}</h1>
                            <Link to={slide.link} className="banner-btn">
                                {slide.btnText} →
                            </Link>
                        </div>
                    </div>
                ))}
            </header>

            {/* Info */}
            <section className="info-section">
                <div className="section-wrapper">
                    <div
                        className="section-title"
                        style={{ textAlign: "center", marginBottom: "5rem" }}
                    >
                        <h2 style={{ fontSize: "3rem", fontWeight: 900 }}>
                            El primer ecosistema todo-en-uno
                        </h2>
                        <p
                            style={{
                                fontSize: "1.2rem",
                                opacity: 0.7,
                                maxWidth: "800px",
                                margin: "0 auto",
                            }}
                        >
                            Todo lo que necesitas ya funciona junto bajo la
                            tecnología Sumaq.
                        </p>
                    </div>

                    <div className="info-grid">
                        <div className="info-card">
                            <span className="card-icon">📱</span>
                            <h3>Para el Mesero</h3>
                            <p style={{ marginBottom: "1.5rem", opacity: 0.8 }}>
                                App táctil diseñada para el alto tráfico de
                                pedidos.
                            </p>
                            <ul style={{ listStyle: "none", padding: 0 }}>
                                <li style={{ marginBottom: "0.8rem" }}>
                                    ✓ Toma de pedidos instantánea
                                </li>
                                <li style={{ marginBottom: "0.8rem" }}>
                                    ✓ Sincronización real con cocina
                                </li>
                                <li>✓ Funciona offline</li>
                            </ul>
                        </div>
                        <div className="info-card">
                            <span className="card-icon">🖥️</span>
                            <h3>Para la Caja</h3>
                            <p style={{ marginBottom: "1.5rem", opacity: 0.8 }}>
                                Software de escritorio robusto y ultrarrápido.
                            </p>
                            <ul style={{ listStyle: "none", padding: 0 }}>
                                <li style={{ marginBottom: "0.8rem" }}>
                                    ✓ Gestión avanzada de ventas
                                </li>
                                <li style={{ marginBottom: "0.8rem" }}>
                                    ✓ Control total de inventario
                                </li>
                                <li>✓ Arqueos y cierres diarios</li>
                            </ul>
                        </div>
                        <div className="info-card">
                            <span className="card-icon">📠</span>
                            <h3>Control de Cocina</h3>
                            <p style={{ marginBottom: "1.5rem", opacity: 0.8 }}>
                                Controlador inteligente basado en Raspberry Pi
                                4.
                            </p>
                            <ul style={{ listStyle: "none", padding: 0 }}>
                                <li style={{ marginBottom: "0.8rem" }}>
                                    ✓ Hasta 3 impresoras simultáneas
                                </li>
                                <li style={{ marginBottom: "0.8rem" }}>
                                    ✓ Impresión segmentada por área
                                </li>
                                <li>✓ Elimina confusiones en despacho</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Clients */}
            <section className="clients-section">
                <h2>CONFÍAN EN EL SABOR DE SUMAQ</h2>
                <div className="logos-container">
                    {companiesData?.allCompanies
                        ?.filter((c: any) => c.logoBase64)
                        .map((company: any) => (
                            <img
                                key={company.id}
                                src={company.logoBase64}
                                alt={company.denomination}
                                className="client-logo"
                                title={company.denomination}
                            />
                        ))}
                    {!companiesData?.allCompanies?.some(
                        (c: any) => c.logoBase64,
                    ) && (
                        <div style={{ fontWeight: 900, opacity: 0.8 }}>
                            EMPRESAS LÍDERES DEL SECTOR GASTRONÓMICO
                        </div>
                    )}
                </div>
            </section>

            {/* Carta Digital */}
            <section className="digital-menu-section">
                <div className="section-wrapper">
                    <div className="menu-preview-container">
                        <div className="menu-selector-panel">
                            <span className="preview-pill">NUEVA FUNCIÓN</span>
                            <h2
                                style={{
                                    fontSize: "3rem",
                                    fontWeight: 900,
                                    marginBottom: "2rem",
                                }}
                            >
                                Carta Digital
                            </h2>
                            <p
                                style={{
                                    opacity: 0.8,
                                    fontSize: "1.3rem",
                                    marginBottom: "3rem",
                                }}
                            >
                                Tus clientes escanean el QR y acceden a una
                                experiencia visual Sumaq.
                            </p>

                            <div className="selector-group">
                                <label
                                    style={{
                                        display: "block",
                                        marginBottom: "15px",
                                        fontWeight: 700,
                                    }}
                                >
                                    Selecciona un restaurante
                                </label>
                                <select
                                    className="company-select"
                                    value={selectedCompanyId}
                                    onChange={(e) =>
                                        setSelectedCompanyId(e.target.value)
                                    }
                                >
                                    {menuData?.allCompanies?.map((c: any) => (
                                        <option key={c.id} value={c.id}>
                                            {c.denomination}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <Link
                                to={`/carta/${selectedCompanyId}`}
                                className="banner-btn"
                                style={{
                                    background: "var(--secondary)",
                                    color: "var(--dark)",
                                    width: "100%",
                                    justifyContent: "center",
                                    marginBottom: "1.5rem",
                                }}
                            >
                                📖 VER CARTA COMPLETA
                            </Link>
                        </div>

                        <div className="menu-preview-display">
                            <header
                                style={{
                                    textAlign: "center",
                                    marginBottom: "3rem",
                                }}
                            >
                                <div
                                    style={{
                                        width: "70px",
                                        height: "70px",
                                        borderRadius: "50%",
                                        background: "var(--primary)",
                                        margin: "0 auto 15px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "white",
                                        fontSize: "1.5rem",
                                        fontWeight: 900,
                                    }}
                                >
                                    {selectedCompany?.denomination?.charAt(0) ||
                                        "S"}
                                </div>
                                <h3 style={{ margin: 0, fontWeight: 900 }}>
                                    {selectedCompany?.denomination ||
                                        "Sumaq Demo"}
                                </h3>
                            </header>

                            <div className="preview-items">
                                {selectedCompany?.branches?.[0]?.categories?.[0]?.subcategories?.[0]?.products
                                    ?.slice(0, 4)
                                    ?.map((p: any) => (
                                        <div
                                            key={p.id}
                                            style={{
                                                display: "flex",
                                                gap: "20px",
                                                padding: "1.5rem 0",
                                                borderBottom: "1px solid #eee",
                                            }}
                                        >
                                            <img
                                                src={
                                                    p.imageBase64 ||
                                                    "https://via.placeholder.com/80"
                                                }
                                                style={{
                                                    width: "80px",
                                                    height: "80px",
                                                    borderRadius: "15px",
                                                    objectFit: "cover",
                                                }}
                                                alt={p.name}
                                            />
                                            <div>
                                                <h4
                                                    style={{
                                                        margin: 0,
                                                        fontWeight: 800,
                                                    }}
                                                >
                                                    {p.name}
                                                </h4>
                                                <p
                                                    style={{
                                                        fontSize: "0.9rem",
                                                        color: "#64748b",
                                                        margin: "5px 0",
                                                    }}
                                                >
                                                    {p.description}
                                                </p>
                                                <span
                                                    style={{
                                                        fontWeight: 900,
                                                        color: "var(--primary)",
                                                    }}
                                                >
                                                    S/ {p.salePrice}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Download */}
            <section className="download-section">
                <div className="section-wrapper">
                    <div className="download-box">
                        <h2
                            style={{
                                fontSize: "3rem",
                                fontWeight: 900,
                                marginBottom: "2rem",
                            }}
                        >
                            Sumaq para Escritorio
                        </h2>
                        <p
                            style={{
                                fontSize: "1.3rem",
                                opacity: 0.9,
                                marginBottom: "3rem",
                            }}
                        >
                            Potencia tu caja con una herramienta estable y
                            ultrarrápida.
                        </p>
                        <div className="download-grid" style={{
                            display: "flex",
                            justifyContent: "center",
                            gap: "30px",
                            flexWrap: "wrap",
                            marginTop: "2rem"
                        }}>
                            <div className="download-card" style={{
                                background: "rgba(255,255,255,0.1)",
                                padding: "2.5rem",
                                borderRadius: "30px",
                                border: "1px solid rgba(255,255,255,0.1)",
                                minWidth: "280px",
                                textAlign: "center",
                                transition: "all 0.3s ease"
                            }}>
                                <span style={{ fontSize: "3rem", display: "block", marginBottom: "1rem" }}>🪟</span>
                                <h3 style={{ margin: "0 0 10px 0", fontSize: "1.5rem" }}>Windows</h3>
                                <p style={{ opacity: 0.7, margin: "0 0 5px 0" }}>SumApp Setup 1.1.1.exe</p>
                                <p style={{ fontWeight: 900, color: "var(--secondary)", margin: "0 0 20px 0" }}>105 MB</p>
                                <a href="/release/SumApp Setup 1.1.1.exe" className="download-btn" style={{ 
                                    padding: "1rem 2rem", 
                                    fontSize: "1.1rem",
                                    margin: 0,
                                    width: "100%",
                                    boxSizing: "border-box"
                                }}>
                                    DESCARGAR .EXE
                                </a>
                            </div>

                            <div className="download-card" style={{
                                background: "rgba(255,255,255,0.1)",
                                padding: "2.5rem",
                                borderRadius: "30px",
                                border: "1px solid rgba(255,255,255,0.1)",
                                minWidth: "280px",
                                textAlign: "center",
                                transition: "all 0.3s ease"
                            }}>
                                <span style={{ fontSize: "3rem", display: "block", marginBottom: "1rem" }}>🐧</span>
                                <h3 style={{ margin: "0 0 10px 0", fontSize: "1.5rem" }}>Linux</h3>
                                <p style={{ opacity: 0.7, margin: "0 0 5px 0" }}>SumApp-1.1.1.AppImage</p>
                                <p style={{ fontWeight: 900, color: "var(--secondary)", margin: "0 0 20px 0" }}>127 MB</p>
                                <a href="/release/SumApp-1.1.1.AppImage" className="download-btn" style={{ 
                                    padding: "1rem 2rem", 
                                    fontSize: "1.1rem",
                                    margin: 0,
                                    width: "100%",
                                    boxSizing: "border-box"
                                }}>
                                    DESCARGAR .APPIMAGE
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Contact */}
            <section className="contact-section">
                <div className="section-wrapper">
                    <h2
                        style={{
                            fontSize: "3rem",
                            fontWeight: 900,
                            color: "var(--primary)",
                            marginBottom: "1.5rem",
                        }}
                    >
                        ¿Listo para el cambio?
                    </h2>
                    <p
                        style={{
                            fontSize: "1.3rem",
                            opacity: 0.7,
                            marginBottom: "4rem",
                        }}
                    >
                        Te mostramos cómo Sumaq puede transformar tu negocio
                        hoy.
                    </p>
                    <a
                        href="https://wa.me/51953716606"
                        className="whatsapp-btn"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        📲 DEMO POR WHATSAPP
                    </a>
                </div>
            </section>

            <footer className="landing-footer">
                <div
                    style={{
                        fontWeight: 900,
                        fontSize: "1.2rem",
                        color: "#fff",
                        marginBottom: "1rem",
                    }}
                >
                    SUMAQ RESTAURANTE
                </div>
                <p style={{ margin: 0, opacity: 0.5 }}>
                    &copy; {new Date().getFullYear()} Sumaq Tech. Raíces
                    cusqueñas.
                </p>
            </footer>
        </div>
    );
};

export default LandingPage;
