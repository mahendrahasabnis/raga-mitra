import React, { createContext, useContext } from "react";

const ClientContext = createContext<string | null>(null);

export const useSelectedClient = () => useContext(ClientContext);

export const ClientProvider: React.FC<{ value: string | null; children: React.ReactNode }> = ({ value, children }) => {
  return <ClientContext.Provider value={value}>{children}</ClientContext.Provider>;
};
