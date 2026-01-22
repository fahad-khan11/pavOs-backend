export type ListMembersQuery = {
    company_id: string;
    after?: string;
    before?: string;
    order?: string;
    direction?: string;
    query?: string;
  };
  