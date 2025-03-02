import type {
  PostgrestError,
  PostgrestTransformBuilder,
} from '@supabase/postgrest-js';
import { GenericSchema } from '@supabase/postgrest-js/dist/cjs/types';
import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryOptions,
  type QueryKey,
  type QueryFunctionContext,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { createInfiniteOffsetKeyGetter } from '../lib/key';

/**
 * The return type of the `useOffsetInfiniteQuery` hook
 */
export type UseOffsetInfiniteQueryReturn<
  Result extends Record<string, unknown>,
> = {
  data?: Result[][];
  size: number;
  setSize: (size: number | ((size: number) => number)) => void;
  error: PostgrestError | null;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  status: 'loading' | 'error' | 'success' | 'pending';
  refetch: () => Promise<any>;
};

/**
 * A hook to perform an infinite postgrest query with offset pagination
 * @param query The postgrest query builder
 * @param config Optional configuration options for the hook
 * @returns An object containing the query results and other React Query related properties
 */
export function useOffsetInfiniteQuery<
  Schema extends GenericSchema,
  Table extends Record<string, unknown>,
  Result extends Record<string, unknown>,
  RelationName = unknown,
  Relationships = unknown,
>(
  query: PostgrestTransformBuilder<
    Schema,
    Table,
    Result[],
    RelationName,
    Relationships
  > | null,
  config?: {
    pageSize?: number;
    fallbackData?: InfiniteData<Result[]>;
  } & Omit<
    UseInfiniteQueryOptions<
      Result[], 
      PostgrestError,
      InfiniteData<Result[]>,
      Result[],
      QueryKey
    >,
    'queryKey' | 'queryFn' | 'getNextPageParam' | 'initialPageParam'
  >,
): UseOffsetInfiniteQueryReturn<Result> {
  const pageSize = config?.pageSize ?? 20;
  
  // Generate query key using createInfiniteOffsetKeyGetter
  const queryKey = query ? 
    createInfiniteOffsetKeyGetter<Schema, Table, Result, RelationName, Relationships>(query, pageSize) : 
    [];
  
  const {
    data,
    error,
    isLoading,
    isError,
    isFetching,
    isSuccess,
    status,
    refetch,
    fetchNextPage,
  } = useInfiniteQuery<
    Result[],
    PostgrestError,
    InfiniteData<Result[]>,
    QueryKey
  >({
    queryKey,
    queryFn: async ({ pageParam }) => {
      if (!query) return [];
      
      const offset = typeof pageParam === 'number' ? pageParam : 0;
      const { data } = await query
        .range(offset * pageSize, (offset + 1) * pageSize - 1)
        .throwOnError();
      
      return data as Result[] || [];
    },
    getNextPageParam: (_lastPage, allPages) => {
      return allPages.length;
    },
    initialPageParam: 0,
    ...config,
  });

  // Calculate size based on fallbackData if available and no data from query yet
  const size = data?.pages?.length || 
    (config?.fallbackData?.pages?.length && !data ? config.fallbackData.pages.length : 0);

  const setSize = useCallback((sizeOrUpdater: number | ((size: number) => number)) => {
    const currentSize = size;
    const newSize = typeof sizeOrUpdater === 'function' 
      ? sizeOrUpdater(currentSize) 
      : sizeOrUpdater;
    
    // If increasing size, fetch more pages
    if (newSize > currentSize) {
      // Fetch pages sequentially
      const pagesToFetch = newSize - currentSize;
      for (let i = 0; i < pagesToFetch; i++) {
        fetchNextPage();
      }
    }
    // If decreasing size, we can't actually remove pages from React Query's cache
    // but we can limit what we return in the data property
  }, [size, fetchNextPage]);

  // Convert React Query's infinite query result to match the expected API
  return {
    data: data?.pages || (config?.fallbackData?.pages && !data ? config.fallbackData.pages : []),
    size,
    setSize,
    error,
    isLoading,
    isError,
    isFetching,
    isSuccess,
    status,
    refetch,
  };
}