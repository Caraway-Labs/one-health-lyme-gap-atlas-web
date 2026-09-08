"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";
import { DATA_DICTIONARY } from "@/lib/data-dictionary";

export function DataDictionaryDialog() {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            {...analyticsControlAttributes("nav_data_dictionary")}
            variant="ghost"
            size="sm"
          />
        }
      >
        Data dictionary
      </DialogTrigger>
      <DialogContent
        className="dictionary-content"
        aria-labelledby="data-dictionary-title"
      >
        <DialogHeader>
          <span className="eyebrow">Reference</span>
          <DialogTitle id="data-dictionary-title">Data dictionary</DialogTitle>
          <DialogDescription>
            Definitions used throughout the Atlas release.
          </DialogDescription>
        </DialogHeader>
        <dl className="dictionary-list">
          {DATA_DICTIONARY.map(({ term, definition }) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{definition}</dd>
            </div>
          ))}
        </dl>
        <DialogFooter>
          <DialogClose
            render={
              <Button
                {...analyticsControlAttributes("nav_data_dictionary_close")}
                variant="secondary"
                aria-label="Close data dictionary"
              />
            }
          >
            Close
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
