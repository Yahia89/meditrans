import { useState } from "react";
import { directoryPagination, parseDirectoryPageSize, type DirectoryPageSize } from "@/lib/directory-state";

interface PaginationState {
  pageSize: DirectoryPageSize;
  page: number;
}

export function useDirectoryPagination(rawPageSize: string, itemCount: number) {
  const pageSize = parseDirectoryPageSize(rawPageSize);
  const [state, setState] = useState<PaginationState>({ pageSize, page: 1 });

  // A bookmarked limit can change outside our handlers through Back/Forward.
  // This primitive guard updates only this hook's pagination state, once per
  // changed limit; query/enrichment identities do not reset forms or selection.
  if (state.pageSize !== pageSize) {
    setState({ pageSize, page: 1 });
  }

  const pagination = directoryPagination(pageSize, state.pageSize === pageSize ? state.page : 1, itemCount);
  const setCurrentPage = (page: number) => setState({ pageSize, page });
  return { ...pagination, setCurrentPage };
}
