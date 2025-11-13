export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          logo_url: string | null;
          email_contact: string;
          status: 'active' | 'inactive';
          created_at: string;
          address: string | null;
          phone: string | null;
          primary_color: string;
          secondary_color: string;
          email_domain: string | null;
          email_domain_verified: boolean;
          opt_out_default: boolean;
          rgpd_text: string;
          email_signature_html: string;
          rgpd_content_md: string;
          cgu_content_md: string;
          privacy_content_md: string;
        };
        Insert: {
          id?: string;
          name: string;
          logo_url?: string | null;
          email_contact: string;
          status?: 'active' | 'inactive';
          created_at?: string;
          address?: string | null;
          phone?: string | null;
          primary_color?: string;
          secondary_color?: string;
          email_domain?: string | null;
          email_domain_verified?: boolean;
          opt_out_default?: boolean;
          rgpd_text?: string;
          email_signature_html?: string;
          rgpd_content_md?: string;
          cgu_content_md?: string;
          privacy_content_md?: string;
        };
        Update: {
          id?: string;
          name?: string;
          logo_url?: string | null;
          email_contact?: string;
          status?: 'active' | 'inactive';
          created_at?: string;
          address?: string | null;
          phone?: string | null;
          primary_color?: string;
          secondary_color?: string;
          email_domain?: string | null;
          email_domain_verified?: boolean;
          opt_out_default?: boolean;
          rgpd_text?: string;
          email_signature_html?: string;
          rgpd_content_md?: string;
          cgu_content_md?: string;
          privacy_content_md?: string;
        };
      };
      app_users: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: 'super_admin' | 'club_admin';
          tenant_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          role: 'super_admin' | 'club_admin';
          tenant_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          role?: 'super_admin' | 'club_admin';
          tenant_id?: string | null;
          created_at?: string;
        };
      };
      campaigns: {
        Row: {
          id: string;
          tenant_id: string;
          title: string;
          screen_type: 'led_ext' | 'led_int' | 'borne_ext' | 'borne_int_mobile' | 'ecran_int_fixe';
          location: string;
          annual_price_hint: number;
          objective_amount: number;
          daily_footfall_estimate: number;
          lighting_hours: any;
          cover_image_url: string | null;
          deadline: string | null;
          description_md: string | null;
          is_public_share_enabled: boolean;
          public_slug: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          title: string;
          screen_type: 'led_ext' | 'led_int' | 'borne_ext' | 'borne_int_mobile' | 'ecran_int_fixe';
          location: string;
          annual_price_hint?: number;
          objective_amount?: number;
          daily_footfall_estimate?: number;
          lighting_hours?: any;
          cover_image_url?: string | null;
          deadline?: string | null;
          description_md?: string | null;
          is_public_share_enabled?: boolean;
          public_slug?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          title?: string;
          screen_type?: 'led_ext' | 'led_int' | 'borne_ext' | 'borne_int_mobile' | 'ecran_int_fixe';
          location?: string;
          annual_price_hint?: number;
          objective_amount?: number;
          daily_footfall_estimate?: number;
          lighting_hours?: any;
          cover_image_url?: string | null;
          deadline?: string | null;
          description_md?: string | null;
          is_public_share_enabled?: boolean;
          public_slug?: string | null;
          created_at?: string;
        };
      };
      sponsors: {
        Row: {
          id: string;
          tenant_id: string;
          company: string;
          contact_name: string;
          email: string;
          segment: 'or' | 'argent' | 'bronze' | 'autre';
          phone: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          company: string;
          contact_name: string;
          email: string;
          segment?: 'or' | 'argent' | 'bronze' | 'autre';
          phone?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          company?: string;
          contact_name?: string;
          email?: string;
          segment?: 'or' | 'argent' | 'bronze' | 'autre';
          phone?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      invitations: {
        Row: {
          id: string;
          campaign_id: string;
          sponsor_id: string;
          email: string;
          token: string;
          status: 'sent' | 'opened' | 'clicked' | 'bounced';
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          sponsor_id: string;
          email: string;
          token?: string;
          status?: 'sent' | 'opened' | 'clicked' | 'bounced';
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          sponsor_id?: string;
          email?: string;
          token?: string;
          status?: 'sent' | 'opened' | 'clicked' | 'bounced';
          expires_at?: string | null;
          created_at?: string;
        };
      };
      pledges: {
        Row: {
          id: string;
          campaign_id: string;
          sponsor_id: string | null;
          status: 'yes' | 'maybe' | 'no';
          amount: number;
          comment: string | null;
          consent: boolean;
          source: 'invite' | 'public' | 'qr';
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          sponsor_id?: string | null;
          status: 'yes' | 'maybe' | 'no';
          amount?: number;
          comment?: string | null;
          consent?: boolean;
          source?: 'invite' | 'public' | 'qr';
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          sponsor_id?: string | null;
          status?: 'yes' | 'maybe' | 'no';
          amount?: number;
          comment?: string | null;
          consent?: boolean;
          source?: 'invite' | 'public' | 'qr';
          created_at?: string;
        };
      };
      scenarios: {
        Row: {
          id: string;
          campaign_id: string;
          params_json: any;
          results_json: any;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          params_json?: any;
          results_json?: any;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          params_json?: any;
          results_json?: any;
          created_at?: string;
        };
      };
      email_events: {
        Row: {
          id: string;
          invitation_id: string;
          event_type: 'sent' | 'opened' | 'clicked' | 'bounced';
          event_data: any | null;
          created_at: string;
          campaign_id: string | null;
          sponsor_id: string | null;
          email: string;
          tenant_id: string | null;
        };
        Insert: {
          id?: string;
          invitation_id: string;
          event_type: 'sent' | 'opened' | 'clicked' | 'bounced';
          event_data?: any | null;
          created_at?: string;
          campaign_id?: string | null;
          sponsor_id?: string | null;
          email: string;
          tenant_id?: string | null;
        };
        Update: {
          id?: string;
          invitation_id?: string;
          event_type?: 'sent' | 'opened' | 'clicked' | 'bounced';
          event_data?: any | null;
          created_at?: string;
          campaign_id?: string | null;
          sponsor_id?: string | null;
          email?: string;
          tenant_id?: string | null;
        };
      };
    };
  };
};
