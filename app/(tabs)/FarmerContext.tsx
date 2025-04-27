import React, { createContext, useState, useEffect, useContext } from "react";
import { db, auth, productsCol, ordersCol } from "./firebaseConfig";
import {
  doc,
  setDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  collection,
} from "firebase/firestore";
import { Product, Order, Customer } from "./types";

interface FarmerContextType {
  products: Product[];
  orders: Order[];
  customers: Customer[];
  addProduct: (product: Omit<Product, "id" | "farmerId" | "createdAt">) => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  updateOrderStatus: (orderId: string, status: "pending" | "completed") => Promise<void>;
  loading: boolean;
  error: string | null;
}

const FarmerContext = createContext<FarmerContextType | null>(null);

export const FarmerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const farmerId = auth.currentUser?.uid;
    if (!farmerId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const productsQuery = query(productsCol, where("farmerId", "==", farmerId));
    const ordersQuery = query(ordersCol, where("farmerId", "==", farmerId));

    const productsUnsub = onSnapshot(
      productsQuery,
      (snapshot) => {
        const productsData = snapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as Product)
        );
        setProducts(productsData);
        setError(null);
      },
      (err) => {
        setError("Failed to load products");
        console.error(err);
      }
    );

    const ordersUnsub = onSnapshot(
      ordersQuery,
      async (snapshot) => {
        const ordersData = snapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as Order)
        );
        setOrders(ordersData);
        setError(null);

        // Fetch customers for these orders
        const customerIds = [...new Set(ordersData.map((o) => o.customerId))];
        if (customerIds.length > 0) {
          try {
            const customersQuery = query(
              collection(db, "customers"),
              where("id", "in", customerIds)
            );
            const customersSnapshot = await getDocs(customersQuery);
            setCustomers(customersSnapshot.docs.map((d) => d.data() as Customer));
          } catch (err) {
            console.error("Failed to load customers:", err);
          }
        }
      },
      (err) => {
        setError("Failed to load orders");
        console.error(err);
      }
    );

    setLoading(false);

    return () => {
      productsUnsub();
      ordersUnsub();
    };
  }, []);

  const addProduct = async (product: Omit<Product, "id" | "farmerId" | "createdAt">) => {
    try {
      const farmerId = auth.currentUser?.uid;
      if (!farmerId) throw new Error("Not authenticated");

      const newProductRef = doc(productsCol);
      await setDoc(newProductRef, {
        ...product,
        farmerId,
        createdAt: new Date(),
      });
    } catch (err) {
      console.error("Error adding product:", err);
      throw err;
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    try {
      await setDoc(doc(productsCol, id), updates, { merge: true });
    } catch (err) {
      console.error("Error updating product:", err);
      throw err;
    }
  };

  const updateOrderStatus = async (orderId: string, status: "pending" | "completed") => {
    try {
      await setDoc(doc(ordersCol, orderId), { status }, { merge: true });
    } catch (err) {
      console.error("Error updating order:", err);
      throw err;
    }
  };

  return (
    <FarmerContext.Provider
      value={{
        products,
        orders,
        customers,
        addProduct,
        updateProduct,
        updateOrderStatus,
        loading,
        error,
      }}
    >
      {children}
    </FarmerContext.Provider>
  );
};

export const useFarmer = () => {
  const context = useContext(FarmerContext);
  if (!context) {
    throw new Error("useFarmer must be used within a FarmerProvider");
  }
  return context;
};