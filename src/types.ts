import { ServiceAccount } from "firebase-admin";

export interface Config {
  defaultProject?: string;
  databaseUrl?: string;
  databaseId?: string;
  [key: string]: any;
}

export interface Credentials {
  type: "oauth2" | "service-account";
  access_token?: string;
  refresh_token?: string | null;
  expiry_date?: number | null;
  token_type?: string | null;
  scope?: string | null;
  created_at?: number;
  service_account?: ServiceAccount;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface FirebaseProject {
  projectId: string;
  displayName: string;
  name: string;
  projectNumber: string;
  lifecycleState: string;
}

export interface ExportOptions {
  output?: string;
  detailed?: boolean;
  importable?: boolean;
  subcollections?: boolean;
  exclude?: string[];
}

export interface ImportOptions {
  batchSize?: number;
  merge?: boolean;
  exclude?: string[];
}

export interface QueryOptions {
  where?: string;
  limit?: number;
  orderBy?: string;
  json?: boolean;
  output?: string;
}

export interface ConvertOptions {
  output?: string;
  versionNumber?: string;
  userEmail?: string;
  description?: string;
  addConditions?: boolean;
  template?: "basic" | "mobile" | "web";
}

export interface RemoteConfigParameter {
  defaultValue: {
    value: string;
  };
  valueType: "STRING" | "BOOLEAN" | "NUMBER" | "JSON";
  description?: string;
  conditionalValues?: any;
}

export interface RemoteConfigVersion {
  versionNumber: string;
  updateTime: string;
  updateUser: {
    email: string;
  };
  updateOrigin: string;
  updateType: string;
}

export interface RemoteConfig {
  conditions: any[];
  parameters: {
    [key: string]: RemoteConfigParameter;
  };
  version: RemoteConfigVersion;
}

export interface CommandOptions {
  serviceAccount?: string;
  project?: string;
  databaseUrl?: string;
  databaseId?: string;
}

export interface AuthenticationMethod {
  type: "oauth" | "service-account";
  description: string;
}

export interface CollectionInfo {
  id: string;
  documentCount: number;
  hasSubcollections: boolean;
}

export type QueryOperator =
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "array-contains"
  | "array-contains-any"
  | "in"
  | "not-in";

export interface WhereClause {
  field: string;
  operator: QueryOperator;
  value: any;
}

export interface OrderByClause {
  field: string;
  direction: "asc" | "desc";
}
