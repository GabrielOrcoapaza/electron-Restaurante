import React from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { GET_COMPANY_FOR_CARTA } from "../../graphql/queries";
import { categoryIconFromIdOrDefault } from "../../constants/categoryIcons";
import "./FullMenuPage.css";

const FullMenuPage: React.FC = () => {
    const { companyId } = useParams<{ companyId: string }>();
    const location = useLocation();
    const branchIdFromQuery = new URLSearchParams(location.search).get(
        "branch",
    );

    const handleDownloadPDF = () => {
        window.print();
    };

    const { data, loading, error } = useQuery(GET_COMPANY_FOR_CARTA, {
        variables: { companyId },
        skip: !companyId,
    });

    if (loading)
        return (
            <div className="menu-page-container">
                <div className="menu-paper">
                    <h1>Cargando...</h1>
                </div>
            </div>
        );
    if (error)
        return (
            <div className="menu-page-container">
                <div className="menu-paper">
                    <h1>Error al cargar la carta</h1>
                </div>
            </div>
        );

    const company = data?.companyById;
    if (!company)
        return (
            <div className="menu-page-container">
                <div className="menu-paper">
                    <h1>Restaurante no encontrado</h1>
                </div>
            </div>
        );

    // Seleccionar la sucursal correcta
    const selectedBranch =
        company.branches?.find((b: any) => b.id === branchIdFromQuery) ||
        company.branches?.[0];

    // Obtener todas las categorías que tengan productos y showInMenu sea true e isActive sea true
    const allCategories =
        selectedBranch?.categories?.filter(
            (cat: any) =>
                cat.showInMenu !== false &&
                cat.isActive !== false &&
                cat.subcategories?.some((sub: any) => sub.products?.length > 0),
        ) || [];

    return (
        <div className="menu-page-container">
            <div className="menu-actions-floating">
                <Link to="/" className="back-to-landing-btn">
                    ← VOLVER
                </Link>
                <button 
                    onClick={handleDownloadPDF} 
                    className="download-pdf-btn"
                    title="Descargar como PDF"
                >
                    <span className="material-icons">download</span>
                    DESCARGAR PDF
                </button>
            </div>

            <div className="menu-paper">
                <header className="menu-header-minimal">
                    <div className="brand-info">
                        <h1 className="brand-name">
                            {company.commercialName || company.denomination}
                        </h1>
                        {selectedBranch && company.branches?.length > 1 && (
                            <p
                                style={{
                                    margin: "5px 0 0",
                                    opacity: 0.6,
                                    fontSize: "0.9rem",
                                    textAlign: "center",
                                }}
                            >
                                Sede: {selectedBranch.name}
                            </p>
                        )}
                        <div className="brand-underline"></div>
                        <div className="brand-since">PRECIOS VÁLIDOS SOLO EN ESTABLECIMIENTO</div>
                    </div>
                    <div className="menu-box">
                        ME
                        <br />
                        NU
                    </div>
                </header>

                <main className="menu-grid">
                    {allCategories.map((category: any) => (
                        <section key={category.id} className="category-block">
                            <div className="category-header-minimal">
                                <span
                                    className="material-icons category-icon"
                                    style={{
                                        color:
                                            category.color || "var(--primary)",
                                        marginRight: "10px",
                                    }}
                                >
                                    {categoryIconFromIdOrDefault(category.icon)}
                                </span>
                                <h2
                                    className="category-title-minimal"
                                    style={{ margin: 0 }}
                                >
                                    {category.alias || category.name}
                                </h2>
                            </div>

                            <div className="products-list-minimal">
                                {category.subcategories?.map((subcategory: any) => {
                                    const activeProducts = subcategory.products?.filter(
                                        (p: any) => p.isActive !== false && p.name?.trim()
                                    ) || [];

                                    if (activeProducts.length === 0) return null;

                                    return (
                                        <div key={subcategory.id} className="subcategory-block">
                                            {category.subcategories.length > 1 && (
                                                <h3 className="subcategory-title-minimal">
                                                    {subcategory.name}
                                                </h3>
                                            )}
                                            {activeProducts.map((product: any) => (
                                                <div
                                                    key={product.id}
                                                    className="product-item-minimal"
                                                >
                                                    <div className="product-row">
                                                        <h4 className="product-name-minimal">
                                                            {product.name}
                                                        </h4>
                                                        <span className="product-price-minimal">
                                                            S/ {Number(product.salePrice).toFixed(2)}
                                                        </span>
                                                    </div>
                                                    {product.description && (
                                                        <p className="product-desc-minimal">
                                                            {product.description}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </main>

                <footer className="footer-minimal">
                    <p>{company.address}</p>
                    <p>{company.ruc} | POWERED BY SUMAPP</p>
                </footer>
            </div>
        </div>
    );
};

export default FullMenuPage;
