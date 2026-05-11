"use client";

import { createContext, useContext } from "react";

export const SearchContext = createContext("");

export function useSearchQuery(): string {
  return useContext(SearchContext);
}
