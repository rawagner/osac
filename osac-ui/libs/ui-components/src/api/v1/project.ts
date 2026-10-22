import { keepPreviousData } from '@tanstack/react-query';

import { type Project, Projects } from '@osac/types';

import { useApiFetch } from '../api-context';
import { cel } from '../cel';
import { type ListParams, apiQueryKey } from '../types';
import { useApiQuery } from '../use-api-query';

const ALL_PROJECTS_PAGE_SIZE = 100;

/**
 * Loads every project across all pages, following pagination until the full
 * collection has been fetched. `isLoading` stays true until all pages are
 * loaded — the resolved data always contains the complete set of projects.
 */
export const useAllProjects = (
  params: ListParams = {
    filter: cel<Project>((filter) => filter.field('metadata.tenant').notEquals('shared')),
  },
) => {
  const client = useApiFetch(Projects);
  return useApiQuery({
    queryKey: apiQueryKey('v1/projects', ['all'], params),
    queryFn: async () => {
      const items: Project[] = [];
      let offset = 0;
      let total = Infinity;
      while (items.length < total) {
        const page = await client.list({ ...params, limit: ALL_PROJECTS_PAGE_SIZE, offset });
        items.push(...page.items);
        total = page.total;
        if (page.items.length === 0) {
          break;
        }
        offset += page.items.length;
      }
      return items;
    },
    placeholderData: keepPreviousData,
  });
};
