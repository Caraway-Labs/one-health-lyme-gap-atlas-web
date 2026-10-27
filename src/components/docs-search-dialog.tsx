"use client";

import { useDocsSearch } from "fumadocs-core/search/client";
import { fetchClient } from "fumadocs-core/search/client/fetch";
import { useOnChange } from "fumadocs-core/utils/use-on-change";
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogFooter,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  TagsList,
  TagsListItem,
} from "fumadocs-ui/components/dialog/search";
import type { DefaultSearchDialogProps } from "fumadocs-ui/components/dialog/search-default";
import { useI18n } from "fumadocs-ui/contexts/i18n";
import { useMemo, useState, type KeyboardEvent } from "react";

const TAG_GROUP_LABEL = "Filter by tag";

/**
 * Default Fumadocs search dialog with tag filters in the tab order.
 * The bundled tag buttons use tabIndex -1, so this dialog keeps the same
 * route, shortcut, and result keys while exposing the filters to keyboard
 * and screen reader users.
 */
export function DocsSearchDialog({
  allowClear = true,
  api,
  defaultTag,
  delayMs,
  footer,
  links,
  tags,
  ...props
}: DefaultSearchDialogProps) {
  const { locale } = useI18n();
  const [tag, setTag] = useState(defaultTag);
  const client = fetchClient({ api, locale, tag });
  const { query, search, setSearch } = useDocsSearch({ client, delayMs });
  const defaultItems = useMemo(() => {
    if (!links || links.length === 0) return null;
    return links.map(([name, link]) => ({
      content: name,
      id: name,
      type: "page" as const,
      url: link,
    }));
  }, [links]);

  useOnChange(defaultTag, (value) => {
    setTag(value);
  });

  function onTagKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "End" &&
      event.key !== "Home"
    ) {
      return;
    }
    const items = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
    ];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) return;
    event.preventDefault();
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft") {
      next = (index - 1 + items.length) % items.length;
    } else if (event.key === "Home") next = 0;
    else next = items.length - 1;
    items[next]?.focus();
  }

  return (
    <SearchDialog
      isLoading={query.isLoading}
      onSearchChange={setSearch}
      search={search}
      {...props}
    >
      <SearchDialogOverlay />
      <SearchDialogContent className="atlas-docs-root">
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList
          items={query.data === "empty" ? defaultItems : query.data}
        />
        <SearchDialogFooter>
          {tags && tags.length > 0 ? (
            <TagsList
              allowClear={allowClear}
              aria-label={TAG_GROUP_LABEL}
              onKeyDown={onTagKeyDown}
              onTagChange={setTag}
              role="group"
              tag={tag}
            >
              {tags.map((item) => (
                <TagsListItem
                  aria-pressed={tag === item.value}
                  className="text-fd-secondary-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
                  key={item.value}
                  tabIndex={0}
                  value={item.value}
                >
                  {item.name}
                </TagsListItem>
              ))}
            </TagsList>
          ) : null}
          {footer}
        </SearchDialogFooter>
      </SearchDialogContent>
    </SearchDialog>
  );
}
