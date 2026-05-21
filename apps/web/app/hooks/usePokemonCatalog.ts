import { useState, useEffect } from 'react';
import { getPokemonCatalog } from '../lib/api';
import type { CatalogPokemon } from '../lib/types';

const PAGE_SIZE = 12; // 4-column grid × 3 rows

export function usePokemonCatalog(): {
  pokemon: CatalogPokemon[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  setPage: (p: number) => void;
} {
  const [pokemon, setPokemon] = useState<CatalogPokemon[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getPokemonCatalog(PAGE_SIZE, page * PAGE_SIZE)
      .then(({ pokemon: data, total: t }) => {
        if (!cancelled) {
          setPokemon(data);
          setTotal(t);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return { pokemon, total, page, totalPages, loading, error, setPage };
}
