import React from "react";
import { useNavigate } from "react-router-dom";
import { useKitchen } from "../../context/KitchenContext";
import { useToast } from "../../context/ToastContext";

const KitchenScreen: React.FC = () => {
  const navigate = useNavigate();
  const {
    items,
    isLoading,
    error,
    activeView,
    setActiveView,
    logout,
    markItemPrepared,
    markOrderPrepared,
  } = useKitchen();
  const { showToast } = useToast();

  const handleLogout = () => {
    logout();
    navigate("/login-kitchen");
  };

  const handleMarkItemPrepared = async (itemId: string) => {
    try {
      await markItemPrepared(itemId);
      showToast("Item marcado como preparado", "success");
    } catch (err) {
      showToast("Error al marcar item como preparado", "error");
    }
  };

  const handleMarkOrderPrepared = async (orderId: string) => {
    try {
      await markOrderPrepared(orderId);
      showToast("Orden marcada como preparada", "success");
    } catch (err) {
      showToast("Error al marcar orden como preparada", "error");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-xl text-gray-600">Cargando items de cocina...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Error al cargar items
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const orders = items.reduce((acc, item) => {
    if (!acc[item.operation.id]) {
      acc[item.operation.id] = {
        ...item.operation,
        items: [],
      };
    }
    acc[item.operation.id].items.push(item);
    return acc;
  }, {} as Record<string, any>);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-400 to-red-500 rounded-lg flex items-center justify-center">
                <span className="text-xl">🍳</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-800">
                Pantalla de Cocina
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveView("byOrder")}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${activeView === "byOrder" ? "bg-white text-orange-600 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}
                >
                  Por Orden
                </button>
                <button
                  onClick={() => setActiveView("byItem")}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${activeView === "byItem" ? "bg-white text-orange-600 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}
                >
                  Por Item
                </button>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeView === "byOrder" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.values(orders).map((order) => {
              const allPrepared = order.items.every(
                (item: any) => item.isPrepared,
              );
              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-xl shadow-md p-6 border-2 ${allPrepared ? "border-green-400 bg-green-50" : "border-gray-200"}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">
                        Orden {order.order}
                      </h3>
                      {order.table && (
                        <p className="text-gray-600">
                          Mesa: {order.table.name}
                        </p>
                      )}
                    </div>
                    {!allPrepared && (
                      <button
                        onClick={() => handleMarkOrderPrepared(order.id)}
                        className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
                      >
                        Preparar Todo
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {order.items.map((item: any) => (
                      <div
                        key={item.id}
                        className={`flex justify-between items-center p-3 rounded-lg ${item.isPrepared ? "bg-green-100 border border-green-300" : "bg-gray-50 border border-gray-200"}`}
                      >
                        <div>
                          <p className="font-medium text-gray-800">
                            {item.quantity}x {item.productName}
                          </p>
                          {item.notes && (
                            <p className="text-sm text-gray-500 italic">
                              {item.notes}
                            </p>
                          )}
                        </div>
                        {!item.isPrepared && (
                          <button
                            onClick={() => handleMarkItemPrepared(item.id)}
                            className="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
                          >
                            Listo
                          </button>
                        )}
                        {item.isPrepared && (
                          <span className="text-green-600 font-medium">
                            ✓ Preparado
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items
              .filter((item) => !item.isPrepared)
              .map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl shadow-md p-6 border-2 border-gray-200"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">
                        Orden {item.operation.order}
                      </p>
                      <h3 className="text-xl font-bold text-gray-800">
                        {item.quantity}x {item.productName}
                      </h3>
                    </div>
                  </div>
                  {item.notes && (
                    <p className="text-gray-600 italic mb-4">{item.notes}</p>
                  )}
                  <button
                    onClick={() => handleMarkItemPrepared(item.id)}
                    className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
                  >
                    Marcar como Preparado
                  </button>
                </div>
              ))}
          </div>
        )}

        {items.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              No hay items pendientes
            </h2>
            <p className="text-gray-600">
              Todo está listo! Bien hecho equipo!
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default KitchenScreen;
