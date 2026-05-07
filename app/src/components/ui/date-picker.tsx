"use client";

import { useState } from "react";
import { DayPicker } from "react-day-picker";
import { ru } from "date-fns/locale";
import { format, parse } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import "react-day-picker/style.css";

interface DatePickerProps {
  // ISO string yyyy-MM-dd or empty
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  fromYear?: number;
  toYear?: number;
}

// react-day-picker dropdown caption uses native <select> — operators
// can pick year and month directly, then click a day. This solves the
// macOS / mobile native date input usability problems.
export function DatePicker({
  value,
  onChange,
  placeholder = "Выберите дату",
  disabled = false,
  className,
  id,
  fromYear = 2024,
  toYear = new Date().getFullYear() + 5,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-md border border-secondary-300 bg-white px-3 py-2 text-sm text-secondary-900",
            "ring-offset-white placeholder:text-secondary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !selected && "text-secondary-400",
            className
          )}
        >
          <CalendarIcon className="w-4 h-4 text-secondary-400 flex-shrink-0" />
          {selected ? format(selected, "d MMMM yyyy", { locale: ru }) : placeholder}
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0">
        <DayPicker
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (d) {
              onChange(format(d, "yyyy-MM-dd"));
              setOpen(false);
            }
          }}
          captionLayout="dropdown"
          startMonth={new Date(fromYear, 0)}
          endMonth={new Date(toYear, 11)}
          locale={ru}
          showOutsideDays
          weekStartsOn={1}
          className="p-3"
          classNames={{
            month_caption: "flex items-center justify-center gap-1.5 mb-2",
            dropdowns: "flex items-center gap-1.5",
            dropdown:
              "rounded-md border border-secondary-200 bg-white px-2 py-1 text-sm font-medium text-secondary-900 hover:bg-secondary-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500",
            chevron: "fill-secondary-400 hover:fill-secondary-700",
            nav: "flex items-center gap-1",
            button_previous: "p-1 rounded hover:bg-secondary-100",
            button_next: "p-1 rounded hover:bg-secondary-100",
            month_grid: "w-full border-collapse",
            weekdays: "flex",
            weekday: "w-9 h-9 text-xs font-medium text-secondary-500 flex items-center justify-center",
            week: "flex",
            day: "w-9 h-9 p-0",
            day_button:
              "w-9 h-9 rounded-md text-sm text-secondary-900 hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500",
            today: "font-bold text-primary-700",
            selected:
              "[&>button]:bg-primary-600 [&>button]:text-white [&>button]:hover:bg-primary-700",
            outside: "text-secondary-300",
            disabled: "opacity-40 cursor-not-allowed",
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
