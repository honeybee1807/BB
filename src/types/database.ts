
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "admin_profiles": {
                  Row: {
                    "created_at": string,"full_name": string,"id": string,"is_active": boolean,"role": Database["public"]['Enums']["admin_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name": string,"id": string,"is_active"?: boolean,"role"?: Database["public"]['Enums']["admin_role"]
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string,"id"?: string,"is_active"?: boolean,"role"?: Database["public"]['Enums']["admin_role"]
                  }
                  Relationships: [
                    
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"entity_id": string | null,"entity_type": string | null,"id": number,"ip_hash": string | null,"metadata": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: never,"ip_hash"?: string | null,"metadata"?: NonNullable<Json>
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: never,"ip_hash"?: string | null,"metadata"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"availability_blocks": {
                  Row: {
                    "created_at": string,"date": string,"property_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"date": string,"property_id": string
                  }
                  Update: {
                    "created_at"?: string,"date"?: string,"property_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "availability_blocks_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    }
                  ]
                },"blog_posts": {
                  Row: {
                    "author_id": string | null,"body_md": string,"created_at": string,"deleted_at": string | null,"excerpt": string | null,"featured_image_path": string | null,"id": string,"is_published": boolean,"published_at": string | null,"seo_description": string | null,"seo_title": string | null,"slug": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body_md"?: string,"created_at"?: string,"deleted_at"?: string | null,"excerpt"?: string | null,"featured_image_path"?: string | null,"id"?: string,"is_published"?: boolean,"published_at"?: string | null,"seo_description"?: string | null,"seo_title"?: string | null,"slug": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string | null,"body_md"?: string,"created_at"?: string,"deleted_at"?: string | null,"excerpt"?: string | null,"featured_image_path"?: string | null,"id"?: string,"is_published"?: boolean,"published_at"?: string | null,"seo_description"?: string | null,"seo_title"?: string | null,"slug"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blog_posts_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "admin_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"estates": {
                  Row: {
                    "created_at": string,"description": string | null,"hero_image_path": string | null,"id": string,"name": string,"region_id": string,"seo_description": string | null,"seo_title": string | null,"slug": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"hero_image_path"?: string | null,"id"?: string,"name": string,"region_id": string,"seo_description"?: string | null,"seo_title"?: string | null,"slug": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"hero_image_path"?: string | null,"id"?: string,"name"?: string,"region_id"?: string,"seo_description"?: string | null,"seo_title"?: string | null,"slug"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "estates_region_id_fkey"
      columns: ["region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["id"]
    }
                  ]
                },"inquiries": {
                  Row: {
                    "accommodation_type": Database["public"]['Enums']["accommodation_preference"],"additional_requirements": string | null,"adults": number,"assigned_to": string | null,"budget_max_zar": number | null,"budget_min_zar": number | null,"check_in": string,"check_out": string,"children": number,"consent_given_at": string,"created_at": string,"deleted_at": string | null,"email_sent_at": string | null,"guest_email": string,"guest_name": string,"guest_phone": string,"id": string,"internal_notes": string | null,"property_id": string | null,"status": Database["public"]['Enums']["inquiry_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accommodation_type"?: Database["public"]['Enums']["accommodation_preference"],"additional_requirements"?: string | null,"adults": number,"assigned_to"?: string | null,"budget_max_zar"?: number | null,"budget_min_zar"?: number | null,"check_in": string,"check_out": string,"children"?: number,"consent_given_at": string,"created_at"?: string,"deleted_at"?: string | null,"email_sent_at"?: string | null,"guest_email": string,"guest_name": string,"guest_phone": string,"id"?: string,"internal_notes"?: string | null,"property_id"?: string | null,"status"?: Database["public"]['Enums']["inquiry_status"],"updated_at"?: string
                  }
                  Update: {
                    "accommodation_type"?: Database["public"]['Enums']["accommodation_preference"],"additional_requirements"?: string | null,"adults"?: number,"assigned_to"?: string | null,"budget_max_zar"?: number | null,"budget_min_zar"?: number | null,"check_in"?: string,"check_out"?: string,"children"?: number,"consent_given_at"?: string,"created_at"?: string,"deleted_at"?: string | null,"email_sent_at"?: string | null,"guest_email"?: string,"guest_name"?: string,"guest_phone"?: string,"id"?: string,"internal_notes"?: string | null,"property_id"?: string | null,"status"?: Database["public"]['Enums']["inquiry_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inquiries_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "admin_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inquiries_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    }
                  ]
                },"properties": {
                  Row: {
                    "bathrooms": number | null,"bedrooms": number | null,"created_at": string,"custom_fields": NonNullable<Json>,"deleted_at": string | null,"description": string | null,"estate_id": string,"featured_sort_order": number,"halal_details": string | null,"id": string,"instagram_video_url": string | null,"is_featured": boolean,"is_halal": boolean,"is_published": boolean,"max_guests": number | null,"name": string,"price_from_zar": number | null,"property_type": Database["public"]['Enums']["property_type"],"seo_description": string | null,"seo_title": string | null,"slug": string,"summary": string | null,"town": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bathrooms"?: number | null,"bedrooms"?: number | null,"created_at"?: string,"custom_fields"?: NonNullable<Json>,"deleted_at"?: string | null,"description"?: string | null,"estate_id": string,"featured_sort_order"?: number,"halal_details"?: string | null,"id"?: string,"instagram_video_url"?: string | null,"is_featured"?: boolean,"is_halal"?: boolean,"is_published"?: boolean,"max_guests"?: number | null,"name": string,"price_from_zar"?: number | null,"property_type"?: Database["public"]['Enums']["property_type"],"seo_description"?: string | null,"seo_title"?: string | null,"slug": string,"summary"?: string | null,"town"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "bathrooms"?: number | null,"bedrooms"?: number | null,"created_at"?: string,"custom_fields"?: NonNullable<Json>,"deleted_at"?: string | null,"description"?: string | null,"estate_id"?: string,"featured_sort_order"?: number,"halal_details"?: string | null,"id"?: string,"instagram_video_url"?: string | null,"is_featured"?: boolean,"is_halal"?: boolean,"is_published"?: boolean,"max_guests"?: number | null,"name"?: string,"price_from_zar"?: number | null,"property_type"?: Database["public"]['Enums']["property_type"],"seo_description"?: string | null,"seo_title"?: string | null,"slug"?: string,"summary"?: string | null,"town"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "properties_estate_id_fkey"
      columns: ["estate_id"]
isOneToOne: false
      referencedRelation: "estates"
      referencedColumns: ["id"]
    }
                  ]
                },"property_photos": {
                  Row: {
                    "alt_text": string,"created_at": string,"height": number | null,"id": string,"is_cover": boolean,"property_id": string,"sort_order": number,"storage_path": string,"thumb_path": string,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alt_text"?: string,"created_at"?: string,"height"?: number | null,"id"?: string,"is_cover"?: boolean,"property_id": string,"sort_order"?: number,"storage_path": string,"thumb_path": string,"width"?: number | null
                  }
                  Update: {
                    "alt_text"?: string,"created_at"?: string,"height"?: number | null,"id"?: string,"is_cover"?: boolean,"property_id"?: string,"sort_order"?: number,"storage_path"?: string,"thumb_path"?: string,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "property_photos_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_limits": {
                  Row: {
                    "bucket": string,"created_at": string,"id": number,"key_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket": string,"created_at"?: string,"id"?: never,"key_hash": string
                  }
                  Update: {
                    "bucket"?: string,"created_at"?: string,"id"?: never,"key_hash"?: string
                  }
                  Relationships: [
                    
                  ]
                },"regions": {
                  Row: {
                    "created_at": string,"description": string | null,"hero_image_path": string | null,"id": string,"name": string,"seo_description": string | null,"seo_title": string | null,"slug": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"hero_image_path"?: string | null,"id"?: string,"name": string,"seo_description"?: string | null,"seo_title"?: string | null,"slug": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"hero_image_path"?: string | null,"id"?: string,"name"?: string,"seo_description"?: string | null,"seo_title"?: string | null,"slug"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"seo_pages": {
                  Row: {
                    "created_at": string,"description": string,"og_image_path": string | null,"path": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description": string,"og_image_path"?: string | null,"path": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"og_image_path"?: string | null,"path"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "assert_valid_date_range":
{ Args: { "p_from": string,"p_to": string }; Returns: undefined
                           },
"block_dates":
{ Args: { "p_from": string,"p_property_id": string,"p_to": string }; Returns: number
                           },
"get_blocked_dates":
{ Args: { "p_from": string,"p_property_id": string,"p_to": string }; Returns: string[]
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_owner":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_valid_custom_fields":
{ Args: { "p_fields": Json }; Returns: boolean
                           },
"list_active_admins":
{ Args: Record<PropertyKey, never>; Returns: {
              "full_name": string,"id": string
            }[]
                           },
"open_dates":
{ Args: { "p_from": string,"p_property_id": string,"p_to": string }; Returns: number
                           },
"rate_limit_clear":
{ Args: { "p_bucket": string,"p_key_hash": string }; Returns: undefined
                           },
"rate_limit_count":
{ Args: { "p_bucket": string,"p_key_hash": string,"p_window_seconds": number }; Returns: number
                           },
"rate_limit_hit":
{ Args: { "p_bucket": string,"p_key_hash": string,"p_max": number,"p_window_seconds": number }; Returns: boolean
                           },
"rate_limit_record":
{ Args: { "p_bucket": string,"p_key_hash": string }; Returns: undefined
                           }
          }
          Enums: {
            "accommodation_preference": "resort"|"holiday_home"|"no_preference","admin_role": "owner"|"team_member","inquiry_status": "new"|"in_progress"|"actioned","property_type": "resort"|"holiday_home"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "accommodation_preference": ["resort", "holiday_home", "no_preference"],"admin_role": ["owner", "team_member"],"inquiry_status": ["new", "in_progress", "actioned"],"property_type": ["resort", "holiday_home"]
          }
        }
} as const
