begin;

-- Extend only the existing structured layout validator. No application data,
-- RLS policy, Storage object, or authorization grant is changed here.
create or replace function private.website_layout_elements_valid(p_elements jsonb, p_depth integer default 0)
returns boolean
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_element jsonb;
  v_type text;
  v_key text;
  v_text text;
  v_max_length integer;
  v_item record;
  v_target text;
  v_position text;
  v_allowed_types text[];
begin
  if pg_catalog.jsonb_typeof(p_elements) is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_elements) > 30
    or p_depth > 3 then return false; end if;

  for v_item in select value from pg_catalog.jsonb_array_elements(p_elements) loop
    v_element := v_item.value;
    if pg_catalog.jsonb_typeof(v_element) is distinct from 'object'
      or exists (
        select 1 from pg_catalog.jsonb_object_keys(v_element) as item(key)
        where item.key not in ('id', 'type', 'visible', 'title', 'text', 'label', 'href', 'src', 'alt', 'value', 'icon', 'children', 'target', 'position')
      )
      or v_element ->> 'id' is null or v_element ->> 'id' !~ '^[A-Za-z0-9][A-Za-z0-9-]{2,100}$'
      or pg_catalog.jsonb_typeof(v_element -> 'visible') is distinct from 'boolean' then return false; end if;

    v_type := v_element ->> 'type';
    if v_type is null or v_type not in (
      'eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider',
      'feature-list', 'statistic', 'gallery-item', 'card', 'content-group',
      'faq-item', 'testimonial', 'logo', 'call-to-action', 'native-visibility'
    ) then return false; end if;

    if v_type = 'native-visibility' then
      if p_depth <> 0 or not (v_element ? 'target') or v_element ? 'position'
        or v_element ->> 'visible' <> 'false'
        or pg_catalog.jsonb_typeof(v_element -> 'target') is distinct from 'string'
        or exists (
          select 1 from pg_catalog.jsonb_object_keys(v_element) as item(key)
          where item.key not in ('id', 'type', 'visible', 'target')
        ) then return false; end if;
      v_target := v_element ->> 'target';
      if v_target not in (
        'hero.eyebrow', 'hero.title', 'hero.description', 'hero.primary-action', 'hero.featured-label',
        'about.eyebrow', 'about.title', 'about.profile', 'about.feature-one', 'about.feature-two', 'about.statistics',
        'projects.eyebrow', 'projects.title', 'projects.description', 'projects.catalog-button', 'projects.category-label',
        'brief-studio.eyebrow', 'brief-studio.title', 'brief-studio.description',
        'calculator.eyebrow', 'calculator.title', 'calculator.description',
        'contact.eyebrow', 'contact.title', 'contact.description',
        'closing-scene.title', 'site-footer.copyright'
      ) then return false; end if;
    elsif v_element ? 'target' then
      if p_depth <> 0
        or pg_catalog.jsonb_typeof(v_element -> 'target') is distinct from 'string'
        or pg_catalog.jsonb_typeof(v_element -> 'position') is distinct from 'string' then return false; end if;
      v_target := v_element ->> 'target';
      v_position := v_element ->> 'position';
      if v_target not in (
        'hero.eyebrow', 'hero.title', 'hero.description', 'hero.primary-action', 'hero.artwork', 'hero.featured-label', 'hero.social-links',
        'about.eyebrow', 'about.title', 'about.profile', 'about.feature-one', 'about.feature-two', 'about.statistics', 'about.skills',
        'projects.eyebrow', 'projects.title', 'projects.description', 'projects.catalog-button', 'projects.category-label', 'projects.featured-work', 'projects.category-cards',
        'brief-studio.eyebrow', 'brief-studio.title', 'brief-studio.description', 'brief-studio.interactive-builder',
        'calculator.eyebrow', 'calculator.title', 'calculator.description', 'calculator.widget',
        'contact.eyebrow', 'contact.title', 'contact.description', 'contact.channels', 'contact.form',
        'closing-scene.title', 'closing-scene.animation', 'site-footer.brand', 'site-footer.copyright'
      ) or v_position not in ('before', 'after', 'replace') then return false; end if;

      v_allowed_types := case v_target
        when 'hero.eyebrow' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'hero.title' then array['eyebrow', 'heading', 'subheading', 'paragraph']
        when 'hero.description' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'hero.primary-action' then array['button', 'eyebrow', 'paragraph']
        when 'hero.artwork' then array['image', 'gallery-item', 'eyebrow', 'paragraph']
        when 'hero.featured-label' then array['eyebrow', 'paragraph', 'button']
        when 'hero.social-links' then array[]::text[]
        when 'about.eyebrow' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'about.title' then array['eyebrow', 'heading', 'subheading', 'paragraph']
        when 'about.profile' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'about.feature-one' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'about.feature-two' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'about.statistics' then array['statistic', 'feature-list', 'card']
        when 'about.skills' then array[]::text[]
        when 'projects.eyebrow' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'projects.title' then array['eyebrow', 'heading', 'subheading', 'paragraph']
        when 'projects.description' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'projects.catalog-button' then array['button', 'eyebrow', 'paragraph']
        when 'projects.category-label' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'projects.featured-work' then array[]::text[]
        when 'projects.category-cards' then array[]::text[]
        when 'brief-studio.eyebrow' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'brief-studio.title' then array['eyebrow', 'heading', 'subheading', 'paragraph']
        when 'brief-studio.description' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'brief-studio.interactive-builder' then array[]::text[]
        when 'calculator.eyebrow' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'calculator.title' then array['eyebrow', 'heading', 'subheading', 'paragraph']
        when 'calculator.description' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'calculator.widget' then array[]::text[]
        when 'contact.eyebrow' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'contact.title' then array['eyebrow', 'heading', 'subheading', 'paragraph']
        when 'contact.description' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        when 'contact.channels' then array[]::text[]
        when 'contact.form' then array[]::text[]
        when 'closing-scene.title' then array['eyebrow', 'heading', 'subheading', 'paragraph']
        when 'closing-scene.animation' then array[]::text[]
        when 'site-footer.brand' then array[]::text[]
        when 'site-footer.copyright' then array['eyebrow', 'heading', 'subheading', 'paragraph', 'button', 'image', 'icon', 'divider', 'feature-list', 'statistic', 'gallery-item', 'card', 'content-group', 'faq-item', 'testimonial', 'logo', 'call-to-action']
        else array[]::text[]
      end;
      if not (v_type = any(v_allowed_types)) then return false; end if;
    elsif v_element ? 'position' then
      return false;
    end if;

    foreach v_key in array array['title', 'text', 'label', 'alt', 'value'] loop
      if v_element ? v_key then
        if pg_catalog.jsonb_typeof(v_element -> v_key) is distinct from 'string' then return false; end if;
        v_text := v_element ->> v_key;
        v_max_length := case when v_key = 'text' then 3000 else 500 end;
        if pg_catalog.length(v_text) > v_max_length then return false; end if;
      end if;
    end loop;

    if v_element ? 'href' and (
      pg_catalog.jsonb_typeof(v_element -> 'href') is distinct from 'string'
      or pg_catalog.length(v_element ->> 'href') > 2048
      or not (
        v_element ->> 'href' ~* '^https://[[:alnum:].-]+(:[0-9]+)?([/?#][^[:space:]]*)?$'
        or v_element ->> 'href' ~ '^#[A-Za-z0-9-]+$'
        or (v_element ->> 'href' like '/%' and v_element ->> 'href' not like '//%' and pg_catalog.strpos(v_element ->> 'href', '..') = 0)
        or v_element ->> 'href' ~* '^(mailto|tel):[^[:space:]]+$'
      )
    ) then return false; end if;

    if v_element ? 'src' and v_element ->> 'src' <> '' and (
      pg_catalog.jsonb_typeof(v_element -> 'src') is distinct from 'string'
      or pg_catalog.length(v_element ->> 'src') > 2048
      or not (
        v_element ->> 'src' ~* '^https://[[:alnum:].-]+(:[0-9]+)?([/?#][^[:space:]]*)?$'
        or v_element ->> 'src' ~* '^asset:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      )
    ) then return false; end if;

    if v_element ? 'icon' and (pg_catalog.jsonb_typeof(v_element -> 'icon') is distinct from 'string'
      or v_element ->> 'icon' not in ('sparkles', 'palette', 'layers', 'check', 'arrow', 'star', 'quote', 'clock')) then return false; end if;
    if v_element ? 'children' then
      if v_type not in ('card', 'content-group', 'feature-list')
        or not private.website_layout_elements_valid(v_element -> 'children', p_depth + 1) then return false; end if;
    end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$function$;

create or replace function private.is_valid_website_layout(p_config jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_section jsonb;
  v_section_item record;
  v_item record;
  v_kind text;
  v_section_key text;
  v_expected_anchor text;
  v_id text;
  v_anchor text;
  v_order integer;
  v_seen_ids text[] := array[]::text[];
  v_seen_anchors text[] := array[]::text[];
  v_seen_orders integer[] := array[]::integer[];
  v_native_keys text[] := array[]::text[];
  v_visible boolean := false;
  v_allowed_copy text[];
  v_field text;
  v_value text;
begin
  if pg_catalog.jsonb_typeof(p_config) is distinct from 'object'
    or exists (
      select 1 from pg_catalog.jsonb_object_keys(p_config) as item(key)
      where item.key not in ('schemaVersion', 'sections')
    )
    or p_config -> 'schemaVersion' is distinct from '1'::jsonb
    or pg_catalog.jsonb_typeof(p_config -> 'sections') is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_config -> 'sections') < 8
    or pg_catalog.jsonb_array_length(p_config -> 'sections') > 30 then return false; end if;

  for v_section_item in select value from pg_catalog.jsonb_array_elements(p_config -> 'sections') loop
    v_section := v_section_item.value;
    if pg_catalog.jsonb_typeof(v_section) is distinct from 'object'
      or exists (
        select 1 from pg_catalog.jsonb_object_keys(v_section) as item(key)
        where item.key not in ('id', 'kind', 'sectionKey', 'templateId', 'label', 'anchorId', 'visible', 'inNavigation', 'order', 'copy', 'elements', 'appearance')
      ) then return false; end if;

    v_id := v_section ->> 'id';
    v_anchor := v_section ->> 'anchorId';
    if v_id is null or v_id !~ '^[A-Za-z0-9][A-Za-z0-9-]{2,100}$' or v_id = any(v_seen_ids)
      or v_anchor is null or v_anchor !~ '^[A-Za-z][A-Za-z0-9-]{1,63}$' or v_anchor = any(v_seen_anchors)
      or pg_catalog.jsonb_typeof(v_section -> 'label') is distinct from 'string'
      or pg_catalog.length(pg_catalog.btrim(v_section ->> 'label')) not between 1 and 120
      or pg_catalog.jsonb_typeof(v_section -> 'visible') is distinct from 'boolean'
      or pg_catalog.jsonb_typeof(v_section -> 'inNavigation') is distinct from 'boolean'
      or pg_catalog.jsonb_typeof(v_section -> 'order') is distinct from 'number'
      or (v_section ->> 'order')::numeric < 0 or (v_section ->> 'order')::numeric > 1000
      or pg_catalog.trunc((v_section ->> 'order')::numeric) <> (v_section ->> 'order')::numeric then return false; end if;

    v_order := (v_section ->> 'order')::integer;
    if v_order = any(v_seen_orders) then return false; end if;
    v_seen_ids := pg_catalog.array_append(v_seen_ids, v_id);
    v_seen_anchors := pg_catalog.array_append(v_seen_anchors, v_anchor);
    v_seen_orders := pg_catalog.array_append(v_seen_orders, v_order);
    v_visible := v_visible or (v_section ->> 'visible')::boolean;

    if pg_catalog.jsonb_typeof(v_section -> 'copy') is distinct from 'object'
      or pg_catalog.jsonb_typeof(v_section -> 'elements') is distinct from 'array'
      or not private.website_layout_elements_valid(v_section -> 'elements', 0)
      or pg_catalog.jsonb_typeof(v_section -> 'appearance') is distinct from 'object'
      or v_section #>> '{appearance,layout}' is null
      or v_section #>> '{appearance,spacing}' is null
      or v_section #>> '{appearance,alignment}' is null
      or v_section #>> '{appearance,background}' is null
      or v_section #>> '{appearance,typography}' is null
      or v_section #>> '{appearance,accent}' is null
      or v_section #>> '{appearance,responsive}' is null
      or exists (
        select 1 from pg_catalog.jsonb_object_keys(v_section -> 'appearance') as item(key)
        where item.key not in ('layout', 'spacing', 'alignment', 'background', 'typography', 'accent', 'responsive')
      )
      or v_section #>> '{appearance,layout}' not in ('one-column', 'two-column', 'grid')
      or v_section #>> '{appearance,spacing}' not in ('compact', 'comfortable', 'spacious')
      or v_section #>> '{appearance,alignment}' not in ('start', 'center')
      or v_section #>> '{appearance,background}' not in ('default', 'soft', 'dark')
      or v_section #>> '{appearance,typography}' not in ('brand', 'editorial', 'compact')
      or v_section #>> '{appearance,accent}' not in ('forest', 'copper', 'neutral')
      or v_section #>> '{appearance,responsive}' not in ('all', 'desktop', 'mobile') then return false; end if;

    v_kind := v_section ->> 'kind';
    if v_kind = 'native' then
      v_section_key := v_section ->> 'sectionKey';
      v_expected_anchor := case when v_section_key = 'hero' then 'home' else v_section_key end;
      if v_section_key is null or v_id <> v_section_key or v_section ? 'templateId'
        or v_section_key not in ('hero', 'about', 'projects', 'brief-studio', 'calculator', 'contact', 'closing-scene', 'site-footer')
        or v_anchor <> v_expected_anchor
        or v_section_key = any(v_native_keys)
        or exists (
          select 1 from pg_catalog.jsonb_array_elements(v_section -> 'elements') as element(value)
          where element.value ? 'target'
            and pg_catalog.split_part(element.value ->> 'target', '.', 1) <> v_section_key
        ) then return false; end if;
      v_native_keys := pg_catalog.array_append(v_native_keys, v_section_key);
      v_allowed_copy := case v_section_key
        when 'hero' then array['eyebrow', 'titleLine1', 'titleLine2', 'titleLine3', 'description', 'primaryButtonLabel', 'imageAlt', 'featuredLabel', 'heroImageSrc']
        when 'about' then array['eyebrow', 'titleLine1', 'titleLine2', 'profileName', 'role', 'profileDescription', 'featureOneTitle', 'featureOneText', 'featureTwoTitle', 'featureTwoText', 'skillsTitle', 'skillsDescription', 'statsExperienceValue', 'statsExperienceLabel', 'statsProjectsValue', 'statsProjectsLabel', 'statsSuccessValue', 'statsSuccessLabel', 'skillCategoryLabel', 'skillOneName', 'skillOneLevel', 'skillTwoName', 'skillTwoLevel', 'skillsQuote']
        when 'projects' then array['eyebrow', 'title', 'description', 'buttonLabel', 'categoryLabel']
        when 'brief-studio' then array['eyebrow', 'title', 'description']
        when 'calculator' then array[]::text[]
        when 'contact' then array['eyebrow', 'title', 'description', 'channelsTitle', 'cardTitleLead', 'cardTitleAccentOne', 'cardTitleMiddle', 'cardTitleAccentTwo', 'cardTitleEnd', 'contactCardDescription', 'emailLabel', 'contactEmail', 'whatsappLabel', 'whatsappNumber', 'workingHoursLabel', 'workingHours', 'signature', 'formNameLabel', 'formNamePlaceholder', 'formEmailLabel', 'formEmailPlaceholder', 'formSubjectLabel', 'formSubjectPlaceholder', 'formMessageLabel', 'formMessagePlaceholder', 'formNote', 'formButtonLabel']
        when 'closing-scene' then array['titleLine1', 'titleAccent']
        when 'site-footer' then array['role', 'copyright']
      end;
      for v_item in select key, value from pg_catalog.jsonb_each(v_section -> 'copy') loop
        v_field := v_item.key;
        if not (v_field = any(v_allowed_copy)) or pg_catalog.jsonb_typeof(v_item.value) is distinct from 'string'
          or pg_catalog.length(v_item.value #>> '{}') > 3000 then return false; end if;
        v_value := v_item.value #>> '{}';
        if v_field = 'heroImageSrc' and v_value <> '' and not (
          v_value ~* '^https://[[:alnum:].-]+(:[0-9]+)?([/?#][^[:space:]]*)?$'
          or v_value ~* '^asset:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        ) then return false; end if;
        if v_section_key = 'about' and v_field in ('skillOneLevel', 'skillTwoLevel')
          and (v_value !~ '^[0-9]{1,3}$' or v_value::integer not between 1 and 100) then return false; end if;
        if v_section_key = 'about' and v_field in ('statsExperienceValue', 'statsProjectsValue', 'statsSuccessValue')
          and v_value !~ '^[0-9]{1,4}([+]|%)?$' then return false; end if;
        if v_section_key = 'contact' and v_field = 'contactEmail'
          and v_value !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then return false; end if;
        if v_section_key = 'contact' and v_field = 'whatsappNumber'
          and v_value !~ '^[0-9]{7,15}$' then return false; end if;
      end loop;
    elsif v_kind = 'template' then
      if v_section ? 'sectionKey' or v_section ->> 'templateId' is null or v_section ->> 'templateId' not in (
        'text-heading', 'image-text', 'gallery', 'call-to-action', 'services-grid', 'feature-cards',
        'statistics', 'faq', 'testimonials', 'logo-grid', 'divider', 'custom-content'
      ) or pg_catalog.jsonb_object_length(v_section -> 'copy') <> 0
        or exists (
          select 1 from pg_catalog.jsonb_array_elements(v_section -> 'elements') as element(value)
          where element.value ? 'target' or element.value ->> 'type' = 'native-visibility'
        ) then return false; end if;
    else
      return false;
    end if;
  end loop;

  if not v_visible or not (v_native_keys @> array['hero', 'about', 'projects', 'brief-studio', 'calculator', 'contact', 'closing-scene', 'site-footer']) then return false; end if;
  return true;
exception when others then
  return false;
end;
$function$;

revoke all on function private.website_layout_elements_valid(jsonb, integer) from public, anon, authenticated;
revoke all on function private.is_valid_website_layout(jsonb) from public, anon, authenticated;

commit;
