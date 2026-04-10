import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { GET_COMPANY_FOR_CARTA } from '../../graphql/queries';
import './FullMenuPage.css';

const FullMenuPage: React.FC = () => {
    const { companyId } = useParams<{ companyId: string }>();
    
    const { data, loading, error } = useQuery(GET_COMPANY_FOR_CARTA, {
        variables: { companyId },
        skip: !companyId
    });

    if (loading) return <div className="menu-page-container"><div className="menu-paper"><h1>Cargando...</h1></div></div>;
    if (error) return <div className="menu-page-container"><div className="menu-paper"><h1>Error al cargar la carta</h1></div></div>;
    
    const company = data?.companyById;
    if (!company) return <div className="menu-page-container"><div className="menu-paper"><h1>Restaurante no encontrado</h1></div></div>;

    // Obtener todas las categorías que tengan productos
    const allCategories = company.branches?.[0]?.categories?.filter((cat: any) => 
        cat.subcategories?.some((sub: any) => sub.products?.length > 0)
    ) || [];

    return (
        <div className="menu-page-container">
            <Link to="/" className="back-to-landing">← VOLVER</Link>
            
            <div className="menu-paper">
                <header className="menu-header-minimal">
                    <div className="brand-info">
                        <h1 className="brand-name">{company.commercialName || company.denomination}</h1>
                        <div className="brand-underline"></div>
                        <div className="brand-since">CARTA DIGITAL</div>
                    </div>
                    <div className="menu-box">
                        ME<br/>NU
                    </div>
                </header>

                <main className="menu-grid">
                    {allCategories.map((category: any) => (
                        <section key={category.id} className="category-block">
                            <h2 className="category-title-minimal">{category.name}</h2>
                            
                            <div className="products-list-minimal">
                                {category.subcategories?.map((subcategory: any) => (
                                    <React.Fragment key={subcategory.id}>
                                        {subcategory.products?.filter((p:any) => p.isActive !== false && p.name?.trim()).map((product: any) => (
                                            <div key={product.id} className="product-item-minimal">
                                                <div className="product-row">
                                                    <h4 className="product-name-minimal">{product.name}</h4>
                                                    <span className="product-price-minimal">{product.salePrice}</span>
                                                </div>
                                                {product.description && (
                                                    <p className="product-desc-minimal">{product.description}</p>
                                                )}
                                            </div>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </div>
                        </section>
                    ))}
                </main>

                <footer className="footer-minimal">
                    <p>{company.address}</p>
                    <p>{company.ruc} | POWERED BY SUMAQ</p>
                </footer>
            </div>
        </div>
    );
};

export default FullMenuPage;
