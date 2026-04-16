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
const API_MEDIA_URL = GRAPHQL_URL
    ? GRAPHQL_URL.replace("/graphql", "/media/")
    : "/media/";

/**
 * Función para obtener la URL completa de una imagen de forma segura.
 * Evita duplicar el prefijo /media/ si el path ya lo contiene.
 */
const getFullImageUrl = (path: string | null | undefined): string => {
    if (!path) return "";
    if (path.startsWith("http") || path.startsWith("data:")) return path;

    try {
        // Si el path ya tiene /media/, nos aseguramos de no duplicarlo
        if (path.startsWith("/media/")) {
            const base = API_MEDIA_URL.replace(/\/media\/?$/, "");
            const url = new URL(path, base || window.location.origin);
            return url.toString();
        }

        const url = new URL(
            path,
            API_MEDIA_URL.startsWith("http")
                ? API_MEDIA_URL
                : window.location.origin +
                      (API_MEDIA_URL.startsWith("/") ? "" : "/") +
                      API_MEDIA_URL,
        );
        return url.toString();
    } catch (err) {
        console.warn("Error construyendo URL de imagen:", err, {
            path,
            API_MEDIA_URL,
        });
        // Fallback simple si falla el constructor de URL
        return `${API_MEDIA_URL}${path}`.replace(/\/+/g, "/");
    }
};

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
    const [activeDownloadTab, setActiveDownloadTab] = useState<
        "downloads" | "guide"
    >("downloads");

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
        <div
            className={`landing-container ${darkMode ? "dark-mode" : ""} ${
                darkMode
                    ? "bg-slate-900 text-slate-50"
                    : "bg-white text-slate-900"
            }`}
        >
            {/* Nav */}
            <nav className={`landing-nav ${isScrolled ? "scrolled" : ""}`}>
                <div className="landing-logo">
                    Sum<span>app</span>
                </div>
                <div className="nav-actions flex items-center gap-3">
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
                    <div className="section-title mb-12 text-center md:mb-20">
                        <span className="info-badge">SOLUCION MODULAR</span>
                        <h2 className="font-['Outfit'] text-4xl font-black leading-tight md:text-5xl">
                            El primer ecosistema todo-en-uno
                        </h2>
                        <p
                            className={`mx-auto mt-4 max-w-3xl text-base md:text-xl ${
                                darkMode ? "text-slate-300" : "text-slate-600"
                            }`}
                        >
                            Todo lo que necesitas ya funciona junto bajo la
                            tecnología Sumapp.
                        </p>
                    </div>

                    <div className="info-grid">
                        <div className="info-card">
                            <span className="card-icon">📱</span>
                            <h3>Para el Mesero</h3>
                            <p className="mb-6">
                                App táctil diseñada para el alto tráfico de
                                pedidos.
                            </p>
                            <ul className="info-feature-list">
                                <li className="info-point">
                                    ✓ Toma de pedidos instantánea
                                </li>
                                <li className="info-point">
                                    ✓ Sincronización real con cocina
                                </li>
                                <li className="info-point">✓ Funciona offline</li>
                            </ul>
                        </div>
                        <div className="info-card">
                            <span className="card-icon">🖥️</span>
                            <h3>Para la Caja</h3>
                            <p className="mb-6">
                                Software de escritorio robusto y ultrarrápido.
                            </p>
                            <ul className="info-feature-list">
                                <li className="info-point">
                                    ✓ Gestión avanzada de ventas
                                </li>
                                <li className="info-point">
                                    ✓ Control total de inventario
                                </li>
                                <li className="info-point">
                                    ✓ Arqueos y cierres diarios
                                </li>
                            </ul>
                        </div>
                        <div className="info-card">
                            <span className="card-icon">📠</span>
                            <h3>Control de Cocina</h3>
                            <p className="mb-6">
                                Controlador inteligente basado en Raspberry Pi
                                4.
                            </p>
                            <ul className="info-feature-list">
                                <li className="info-point">
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
                                        c.logo
                                            ? getFullImageUrl(c.logo) // Prioridad al archivo
                                            : c.logoBase64
                                              ? c.logoBase64.startsWith("data:")
                                                  ? c.logoBase64
                                                  : `data:image/png;base64,${c.logoBase64}` // Reparación automática
                                              : "/logo_company.png" // Fallback
                                    }
                                    alt={c.commercialName}
                                    className="client-logo"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src =
                                            "/logo_company.png";
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
                        <div
                            className={`menu-info-panel rounded-3xl border p-6 md:p-10 ${
                                darkMode
                                    ? "border-slate-700 bg-slate-800/60 text-slate-100"
                                    : "border-slate-200 bg-white text-slate-900"
                            }`}
                        >
                            <span className="preview-pill">NUEVA FUNCIÓN</span>
                            <h2 className="font-['Outfit'] text-3xl font-extrabold md:text-4xl">
                                Carta Digital Interactiva
                            </h2>
                            <p
                                className={`mt-4 text-base leading-relaxed ${
                                    darkMode
                                        ? "text-slate-300"
                                        : "text-slate-600"
                                }`}
                            >
                                Tus clientes escanean el QR y acceden a una
                                experiencia visual Sumapp.
                            </p>

                            <div className="selector-group mt-6">
                                <label
                                    className={`mb-2 block text-sm font-semibold ${
                                        darkMode
                                            ? "text-slate-200"
                                            : "text-slate-700"
                                    }`}
                                >
                                    Restaurante
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

                            {selectedCompany?.branches?.length > 1 && (
                                <div className="selector-group">
                                    <label
                                        className={`mb-2 block text-sm font-semibold ${
                                            darkMode
                                                ? "text-slate-200"
                                                : "text-slate-700"
                                        }`}
                                    >
                                        Sede
                                    </label>
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

                            <div className="qr-preview-section mt-8 flex flex-col items-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                                <div className="bg-white p-3 rounded-xl shadow-md">
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/#/carta/${selectedCompanyId}${selectedBranchId ? `?branch=${selectedBranchId}` : ""}`)}&bgcolor=ffffff&color=0f172a&margin=5`}
                                        alt="QR Carta Digital"
                                        className="w-32 h-32"
                                    />
                                </div>
                                <p className="mt-4 text-[10px] font-black tracking-widest text-emerald-600 dark:text-emerald-400 uppercase">
                                    ESCANEAME PARA PROBAR
                                </p>
                            </div>

                            <Link
                                to={`/carta/${selectedCompanyId}${selectedBranchId ? `?branch=${selectedBranchId}` : ""}`}
                                className="banner-btn mt-6 flex w-full justify-center text-center py-4"
                            >
                                VER CARTA COMPLETA
                            </Link>
                        </div>

                        <div className="menu-preview-display">
                            <header className="preview-header">
                                <div className="preview-avatar">
                                    <img
                                        src={
                                            selectedCompany?.logo
                                                ? getFullImageUrl(
                                                      selectedCompany.logo,
                                                  )
                                                : selectedCompany?.logoBase64
                                                  ? selectedCompany.logoBase64.startsWith(
                                                        "data:",
                                                    )
                                                      ? selectedCompany.logoBase64
                                                      : `data:image/png;base64,${selectedCompany.logoBase64}`
                                                  : "/logo_company.png"
                                        }
                                        alt={selectedCompany?.commercialName}
                                        onError={(e) => {
                                            const target =
                                                e.target as HTMLImageElement;
                                            console.error(
                                                "DETALLE ERROR LOGO:",
                                                {
                                                    empresa:
                                                        selectedCompany?.commercialName,
                                                    urlIntentada: target.src,
                                                    pathOriginal:
                                                        selectedCompany?.logo,
                                                    apiMediaUrl: API_MEDIA_URL,
                                                    baseURI: document.baseURI,
                                                },
                                            );
                                            target.src = "/logo_company.png";
                                        }}
                                    />
                                </div>
                                <h3>
                                    {selectedCompany?.commercialName ||
                                        selectedCompany?.denomination}
                                </h3>
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
                                                        p.image
                                                            ? getFullImageUrl(
                                                                  p.image,
                                                              )
                                                            : p.imageBase64
                                                              ? p.imageBase64.startsWith(
                                                                    "data:",
                                                                )
                                                                  ? p.imageBase64
                                                                  : `data:image/png;base64,${p.imageBase64}`
                                                              : "/default_dish.png"
                                                    }
                                                    alt={p.name}
                                                    onError={(e) => {
                                                        const target =
                                                            e.target as HTMLImageElement;
                                                        console.error(
                                                            "DETALLE ERROR PRODUCTO:",
                                                            {
                                                                producto:
                                                                    p.name,
                                                                urlIntentada:
                                                                    target.src,
                                                                pathOriginal:
                                                                    p.image,
                                                                apiMediaUrl:
                                                                    API_MEDIA_URL,
                                                            },
                                                        );
                                                        target.src =
                                                            "/default_dish.png";
                                                    }}
                                                />
                                            </div>
                                            <div className="item-info">
                                                <h4>{p.name}</h4>
                                                <p>{p.description}</p>
                                                <span className="item-price">
                                                    S/{" "}
                                                    {Number(
                                                        p.salePrice,
                                                    ).toFixed(2)}
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
            <section className="download-section" id="downloads">
                <div className="section-wrapper">
                    <div
                        className={`download-box ${
                            darkMode
                                ? "border-slate-700 bg-slate-800 text-slate-100"
                                : "border-slate-200 bg-white text-slate-900"
                        }`}
                    >
                        <div className="download-tabs-header">
                            <button
                                className={`download-tab-btn ${activeDownloadTab === "downloads" ? "active" : ""}`}
                                onClick={() => setActiveDownloadTab("downloads")}
                            >
                                <span className="material-icons">download</span>
                                DESCARGAS
                            </button>
                            <button
                                className={`download-tab-btn ${activeDownloadTab === "guide" ? "active" : ""}`}
                                onClick={() => setActiveDownloadTab("guide")}
                            >
                                <span className="material-icons">menu_book</span>
                                GUÍA DE INSTALACIÓN
                            </button>
                        </div>

                        {activeDownloadTab === "downloads" ? (
                            <div className="download-tab-content">
                                <span className="download-badge">
                                    DESCARGAS OFICIALES
                                </span>
                                <h2>SumApp para Escritorio</h2>
                                <p>
                                    La potencia del sistema integral en tu
                                    computadora.
                                </p>
                                <a
                                    href="https://github.com/GabrielOrcoapaza/electron-Restaurante/releases/latest/download/SumApp.exe"
                                    className="download-btn"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <span className="material-icons">
                                        download
                                    </span>
                                    DESCARGAR PARA WINDOWS
                                </a>
                                <div className="platform-grid">
                                    <div
                                        className={`platform-card ${
                                            darkMode
                                                ? "border-slate-700 bg-slate-900 text-slate-100"
                                                : "border-slate-200 bg-slate-50 text-slate-900"
                                        }`}
                                    >
                                        <span className="material-icons">
                                            laptop
                                        </span>
                                        <h4>Linux (.AppImage)</h4>
                                        <a href="#">DESCARGAR</a>
                                    </div>
                                    <div
                                        className={`platform-card ${
                                            darkMode
                                                ? "border-slate-700 bg-slate-900 text-slate-100"
                                                : "border-slate-200 bg-slate-50 text-slate-900"
                                        }`}
                                    >
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
                        ) : (
                            <div className="guide-tab-content">
                                <div className="guide-welcome">
                                    <h3>Configuración de SumApp Desktop</h3>
                                    <p>Sigue esta guía paso a paso para poner en marcha el sistema en tu restaurante.</p>
                                </div>

                                <div className="guide-steps-container">
                                    {/* Pasos 1-3 */}
                                    <div className="guide-step">
                                        <div className="step-number">01</div>
                                        <div className="step-body">
                                            <h4>Descargar e instalar</h4>
                                            <p>Descarga "SumApp para Escritorio" desde la pestaña anterior u oficial: <a href="https://sumapp.pe/">https://sumapp.pe/</a></p>
                                            <p>Ejecuta el instalador y sigue las instrucciones en pantalla. Al finalizar, aparecerá el ícono de SumApp en tu escritorio.</p>
                                        </div>
                                    </div>

                                    <div className="guide-step">
                                        <div className="step-number">02</div>
                                        <div className="step-body">
                                            <h4>Primer inicio - Configurar sucursal</h4>
                                            <p>Ejecuta SumApp e ingresa los datos de conexión:</p>
                                            <ul className="guide-list">
                                                <li>RUC de la sucursal</li>
                                                <li>Correo corporativo</li>
                                                <li>Contraseña (asignada por el administrador)</li>
                                            </ul>
                                            <div className="guide-warning">
                                                <span className="material-icons">warning</span>
                                                <p><strong>¿Olvidaste tu contraseña?</strong> Usa el link "¿Olvidaste tu contraseña?" o contacta a tu administrador.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="guide-step">
                                        <div className="step-number">03</div>
                                        <div className="step-body">
                                            <h4>Iniciar sesión como usuario</h4>
                                            <p>Selecciona tu usuario según tu rol (mozo, cajero, administrador) e ingresa tu contraseña personal.</p>
                                        </div>
                                    </div>

                                    <div className="guide-step">
                                        <div className="step-number">04</div>
                                        <div className="step-body">
                                            <h4>Panel de pisos y mesas</h4>
                                            <p>Selecciona un piso e identifica el estado de las mesas por color:</p>
                                            <div className="mesa-legend">
                                                <div className="legend-item"><span className="dot verde"></span> <strong>Verde:</strong> Libre</div>
                                                <div className="legend-item"><span className="dot rojo"></span> <strong>Rojo:</strong> Ocupada</div>
                                                <div className="legend-item"><span className="dot amarillo"></span> <strong>Amarillo:</strong> Por pagar</div>
                                            </div>
                                            <img src="/guides/desktop/step_4.png" alt="Pisos y mesas" className="guide-img" />
                                        </div>
                                    </div>

                                    <div className="guide-step">
                                        <div className="step-number">05</div>
                                        <div className="step-body">
                                            <h4>Tomar el pedido</h4>
                                            <p>Navega por categorías y subcategorías para seleccionar los platos deseados. Puedes ajustar cantidades y agregar notas especiales.</p>
                                            <img src="/guides/desktop/step_5.png" alt="Tomar pedido" className="guide-img" />
                                        </div>
                                    </div>

                                    <div className="guide-step">
                                        <div className="step-number">06</div>
                                        <div className="step-body">
                                            <h4>Enviar a cocina</h4>
                                            <p>Pulsa <strong>"Enviar a cocina"</strong>. El sistema te redirigirá al panel de mesas y el pedido se imprimirá automáticamente vía Raspberry Pi.</p>
                                        </div>
                                    </div>

                                    <div className="guide-step">
                                        <div className="step-number">07</div>
                                        <div className="step-body">
                                            <h4>Gestionar un pedido activo</h4>
                                            <p>Haz clic en una mesa roja para ver las opciones de gestión:</p>
                                            
                                            <div className="guide-sub-step">
                                                <h5>Opción A: ORDEN (Añadir platos)</h5>
                                                <p>Agrega nuevos platos y vuelve a pulsar "Enviar a cocina". También puedes imprimir la <strong>Precuenta</strong> para que el comensal sepa cuánto pagará.</p>
                                                <img src="/guides/desktop/step_7a.png" alt="Muro de orden" className="guide-img" />
                                            </div>

                                            <div className="guide-sub-step">
                                                <h5>Opción B: CAJA (Procesar pago)</h5>
                                                <p>Selecciona qué items pagar, el tipo de documento (Boleta/Factura) y el medio de pago (Efectivo, Yape, Tarjeta, etc.).</p>
                                                <img src="/guides/desktop/step_7b.png" alt="Procesar pago" className="guide-img" />
                                            </div>

                                            <div className="guide-info-box">
                                                <h6>Operaciones avanzadas</h6>
                                                <ul className="guide-list small">
                                                    <li><strong>Cambio de mesa/platos:</strong> Mueve órdenes entre pisos o mesas.</li>
                                                    <li><strong>Transferir mozo:</strong> Delega la atención.</li>
                                                    <li><strong>Anular Orden:</strong> Cancela el pedido y libera la mesa.</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="guide-step">
                                        <div className="step-number">08</div>
                                        <div className="step-body">
                                            <h4>Cerrar sesión o salir</h4>
                                            <p>Ve al menú principal → <strong>Cerrar Sesión</strong>. Para cerrar la aplicación usa <strong>Archivo → Salir</strong> o Alt+F4.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Contact */}
            <section className="contact-section">
                <div className="section-wrapper">
                    <h2 className="font-['Outfit'] text-3xl font-extrabold md:text-4xl">
                        ¿Listo para digitalizar tu negocio?
                    </h2>
                    <p className="mx-auto mt-4 max-w-2xl text-base md:text-lg">
                        Contáctanos hoy y descubre cómo transformar tu
                        restaurante.
                    </p>
                    <a
                        href={`https://wa.me/51973591709?text=${encodeURIComponent("Hola, quiero información sobre Sumaq para mi restaurante. ¿Podemos agendar una demo?")}`}
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
