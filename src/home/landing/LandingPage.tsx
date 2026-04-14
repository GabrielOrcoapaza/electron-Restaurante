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

const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL || "";
const API_MEDIA_URL = GRAPHQL_URL.replace("/graphql", "/media/");

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
    const [selectedBranchId, setSelectedBranchId] = useState<string>("");
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
        }, 10000);
        return () => clearInterval(timer);
    }, []);

    const nextSlide = () => {
        setCurrentSlide((prev) => (prev + 1) % banners.length);
    };

    const prevSlide = () => {
        setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length);
    };

    useEffect(() => {
        localStorage.setItem("sumaq-theme", darkMode ? "dark" : "light");
    }, [darkMode]);

    const selectedCompany = useMemo(() => {
        if (!menuData?.allCompanies || !selectedCompanyId) return null;
        return menuData.allCompanies.find(
            (c: any) => c.id === selectedCompanyId,
        );
    }, [menuData, selectedCompanyId]);

    const selectedBranch = useMemo(() => {
        if (!selectedCompany?.branches) return null;
        if (!selectedBranchId) return selectedCompany.branches[0];
        return (
            selectedCompany.branches.find(
                (b: any) => b.id === selectedBranchId,
            ) || selectedCompany.branches[0]
        );
    }, [selectedCompany, selectedBranchId]);

    useEffect(() => {
        if (menuData?.allCompanies?.length > 0 && !selectedCompanyId) {
            setSelectedCompanyId(menuData.allCompanies[0].id);
        }
    }, [menuData, selectedCompanyId]);

    useEffect(() => {
        if (selectedCompany?.branches?.length > 0) {
            setSelectedBranchId(selectedCompany.branches[0].id);
        } else {
            setSelectedBranchId("");
        }
    }, [selectedCompany]);

    return (
        <div className={`landing-container ${darkMode ? "dark-mode" : ""}`}>
            {/* Nav */}
            <nav className={`landing-nav ${isScrolled ? "scrolled" : ""}`}>
                <div className="landing-logo">
                    Sum<span>app</span>
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

                {/* Arrow Controls */}
                <button className="banner-arrow prev" onClick={prevSlide}>
                    <span className="material-icons">chevron_left</span>
                </button>
                <button className="banner-arrow next" onClick={nextSlide}>
                    <span className="material-icons">chevron_right</span>
                </button>

                {/* Dot Indicators */}
                <div className="banner-dots">
                    {banners.map((_, index) => (
                        <span
                            key={index}
                            className={`dot ${index === currentSlide ? "active" : ""}`}
                            onClick={() => setCurrentSlide(index)}
                        ></span>
                    ))}
                </div>
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
                            tecnología Sumapp.
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
                            </ul>
                        </div>
                        <div className="info-card">
                            <div className="card-icon">
                                <span className="material-icons">
                                    smartphone
                                </span>
                            </div>
                            <h3>App de Mozos</h3>
                            <p>
                                Toma pedidos rápidamente desde cualquier
                                smartphone o tablet.
                            </p>
                        </div>
                        <div className="info-card">
                            <div className="card-icon">
                                <span className="material-icons">
                                    restaurant
                                </span>
                            </div>
                            <h3>Sistema para Cocina</h3>
                            <p>
                                Gestión eficiente de comandas en tiempo real
                                para evitar retrasos.
                            </p>
                        </div>
                        <div className="info-card">
                            <div className="card-icon">
                                <span className="material-icons">computer</span>
                            </div>
                            <h3>Software de Caja</h3>
                            <p>
                                Control total de facturación, inventarios y
                                reportes detallados.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Clients */}
            <section className="clients-section">
                <div className="section-wrapper">
                    <h2>Empresas que confían en Sumapp</h2>
                    <div className="logos-container">
                        {companiesData?.allCompanies
                            ?.slice(0, 6)
                            .map((c: any) => (
                                <img
                                    key={c.id}
                                    src={
                                        c.logoBase64
                                            ? c.logoBase64
                                            : c.logo
                                            ? `${API_MEDIA_URL}${c.logo}`
                                            : "/logo_company.png"
                                    }
                                    alt={c.commercialName}
                                    className="client-logo"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = "/logo_company.png";
                                    }}
                                />
                            ))}
                    </div>
                </div>
            </section>

            {/* Digital Menu */}
            <section className="digital-menu-section">
                <div className="section-wrapper">
                    <div className="menu-preview-container">
                        <div className="menu-info-panel">
                            <span className="preview-pill">NUEVA FUNCIÓN</span>
                            <h2>Carta Digital Interactiva</h2>
                            <p>
                                Tus clientes escanean el QR y acceden a una
                                experiencia visual Sumapp.
                            </p>

                            <div className="selector-group">
                                <label>Restaurante</label>
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

                            {selectedCompany?.branches?.length > 1 && (
                                <div className="selector-group">
                                    <label>Sede</label>
                                    <select
                                        className="company-select"
                                        value={selectedBranchId}
                                        onChange={(e) =>
                                            setSelectedBranchId(e.target.value)
                                        }
                                    >
                                        {selectedCompany.branches.map(
                                            (b: any) => (
                                                <option key={b.id} value={b.id}>
                                                    {b.name}
                                                </option>
                                            ),
                                        )}
                                    </select>
                                </div>
                            )}

                            <Link
                                to={`/carta/${selectedCompanyId}${selectedBranchId ? `?branch=${selectedBranchId}` : ""}`}
                                className="banner-btn"
                                style={{
                                    width: "100%",
                                    justifyContent: "center",
                                }}
                            >
                                VER CARTA COMPLETA
                            </Link>
                        </div>

                        <div className="menu-preview-display">
                            <header className="preview-header">
                                <div className="preview-avatar">
                                    <img 
                                        src={
                                            selectedCompany?.logoBase64 
                                            ? selectedCompany.logoBase64 
                                            : selectedCompany?.logo 
                                            ? `${API_MEDIA_URL}${selectedCompany.logo}` 
                                            : "/logo_company.png"
                                        } 
                                        alt="Logo"
                                        onError={(e) => { (e.target as HTMLImageElement).src = "/logo_company.png"; }}
                                    />
                                </div>
                                <h3>{selectedCompany?.commercialName || selectedCompany?.denomination}</h3>
                            </header>

                            <div className="preview-items">
                                {selectedBranch?.categories
                                    ?.find(
                                        (cat: any) =>
                                            cat.showInMenu !== false &&
                                            cat.isActive !== false,
                                    )
                                    ?.subcategories?.[0]?.products?.slice(0, 4)
                                    ?.map((p: any) => (
                                        <div
                                            key={p.id}
                                            className="preview-item"
                                        >
                                            <div className="preview-item-image">
                                                <img
                                                    src={
                                                        p.imageBase64 ||
                                                        "/default_dish.png"
                                                    }
                                                    alt={p.name}
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = "/default_dish.png";
                                                    }}
                                                />
                                            </div>
                                            <div className="item-info">
                                                <h4>{p.name}</h4>
                                                <p>{p.description}</p>
                                                <span className="item-price">
                                                    S/ {Number(p.salePrice).toFixed(2)}
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
                        <h2>Sumapp para Escritorio</h2>
                        <p>
                            La potencia del sistema integral en tu computadora.
                        </p>
                        <a href="#" className="download-btn">
                            DESCARGAR PARA WINDOWS
                        </a>
                        <div className="platform-grid">
                            <div className="platform-card">
                                <span className="material-icons">laptop</span>
                                <h4>Linux (.AppImage)</h4>
                                <a href="#">DESCARGAR</a>
                            </div>
                            <div className="platform-card">
                                <span className="material-icons">
                                    phone_android
                                </span>
                                <h4>Android (Play Store)</h4>
                                <a href="https://play.google.com/store/apps/details?id=com.soluciones4.sumapp">
                                    VER APP
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Contact */}
            <section className="contact-section">
                <div className="section-wrapper">
                    <h2>¿Listo para digitalizar tu negocio?</h2>
                    <p>
                        Contáctanos hoy y descubre cómo transformar tu
                        restaurante.
                    </p>
                    <a
                        href="https://wa.me/51953716606"
                        className="whatsapp-btn"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        SOLICITAR DEMO POR WHATSAPP
                    </a>
                </div>
            </section>

            <footer className="landing-footer">
                <div className="footer-brand">SUMAPP RESTAURANTE</div>
                <p>
                    &copy; {new Date().getFullYear()} Soluciones 4 Sumapp.
                    Tecnología para crecer.
                </p>
            </footer>
        </div>
    );
};

export default LandingPage;
