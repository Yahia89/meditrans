/**
 * BulkImportDataGrid - Interactive data grid for reviewing and editing imported trip data
 */

import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table";
import type {
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  ColumnResizeMode,
} from "@tanstack/react-table";
import type { TripImportRow } from "./broker-templates";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ArrowUp,
  ArrowDown,
  Pencil,
  Check,
  X,
  WarningCircle,
  CheckCircle,
  FunnelSimple,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface BulkImportDataGridProps {
  data: TripImportRow[];
  onDataChange: (data: TripImportRow[]) => void;
}

export function BulkImportDataGrid({
  data,
  onDataChange,
}: BulkImportDataGridProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const columnResizeMode: ColumnResizeMode = "onChange";
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    columnId: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Define columns based on the data
  const columns = useMemo<ColumnDef<TripImportRow>[]>(() => {
    const baseColumns: ColumnDef<TripImportRow>[] = [
      {
        id: "status",
        header: "Status",
        size: 80,
        cell: ({ row }) => {
          const errors = row.original._validation_errors || [];
          const hasErrors = errors.length > 0;

          return (
            <div className="flex items-center justify-center">
              {hasErrors ? (
                <div className="flex items-center gap-2 text-amber-600">
                  <WarningCircle size={18} weight="fill" />
                  <span className="text-xs font-medium">{errors.length}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle size={18} weight="fill" />
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "patient_full_name",
        header: "Patient Name",
        size: 180,
        cell: ({ row, getValue }) => {
          const value = getValue() as string;
          const isEditing =
            editingCell?.rowIndex === row.index &&
            editingCell?.columnId === "patient_full_name";

          return (
            <EditableCell
              value={value || ""}
              isEditing={isEditing}
              onEdit={() =>
                handleStartEdit(row.index, "patient_full_name", value)
              }
              onSave={(newValue) =>
                handleSave(row.index, "patient_full_name", newValue)
              }
              onCancel={handleCancelEdit}
              editValue={editValue}
              setEditValue={setEditValue}
            />
          );
        },
      },
      {
        accessorKey: "patient_phone",
        header: "Phone",
        size: 140,
        cell: ({ row, getValue }) => {
          const value = getValue() as string;
          const isEditing =
            editingCell?.rowIndex === row.index &&
            editingCell?.columnId === "patient_phone";

          return (
            <EditableCell
              value={value || ""}
              isEditing={isEditing}
              onEdit={() => handleStartEdit(row.index, "patient_phone", value)}
              onSave={(newValue) =>
                handleSave(row.index, "patient_phone", newValue)
              }
              onCancel={handleCancelEdit}
              editValue={editValue}
              setEditValue={setEditValue}
            />
          );
        },
      },
      {
        accessorKey: "pickup_address",
        header: "Pickup Address",
        size: 250,
        cell: ({ row, getValue }) => {
          const value = getValue() as string;
          const isEditing =
            editingCell?.rowIndex === row.index &&
            editingCell?.columnId === "pickup_address";

          return (
            <EditableCell
              value={value || ""}
              isEditing={isEditing}
              onEdit={() => handleStartEdit(row.index, "pickup_address", value)}
              onSave={(newValue) =>
                handleSave(row.index, "pickup_address", newValue)
              }
              onCancel={handleCancelEdit}
              editValue={editValue}
              setEditValue={setEditValue}
              required
            />
          );
        },
      },
      {
        accessorKey: "dropoff_address",
        header: "Dropoff Address",
        size: 250,
        cell: ({ row, getValue }) => {
          const value = getValue() as string;
          const isEditing =
            editingCell?.rowIndex === row.index &&
            editingCell?.columnId === "dropoff_address";

          return (
            <EditableCell
              value={value || ""}
              isEditing={isEditing}
              onEdit={() =>
                handleStartEdit(row.index, "dropoff_address", value)
              }
              onSave={(newValue) =>
                handleSave(row.index, "dropoff_address", newValue)
              }
              onCancel={handleCancelEdit}
              editValue={editValue}
              setEditValue={setEditValue}
              required
            />
          );
        },
      },
      {
        accessorKey: "trip_date",
        header: "Trip Date",
        size: 130,
        cell: ({ row, getValue }) => {
          const value = getValue() as string;
          const isEditing =
            editingCell?.rowIndex === row.index &&
            editingCell?.columnId === "trip_date";

          return (
            <EditableCell
              value={value || ""}
              isEditing={isEditing}
              onEdit={() => handleStartEdit(row.index, "trip_date", value)}
              onSave={(newValue) =>
                handleSave(row.index, "trip_date", newValue)
              }
              onCancel={handleCancelEdit}
              editValue={editValue}
              setEditValue={setEditValue}
              required
            />
          );
        },
      },
      {
        accessorKey: "pickup_time",
        header: "Pickup Time",
        size: 120,
        cell: ({ row, getValue }) => {
          const value = getValue() as string;
          const isEditing =
            editingCell?.rowIndex === row.index &&
            editingCell?.columnId === "pickup_time";

          return (
            <EditableCell
              value={value || ""}
              isEditing={isEditing}
              onEdit={() => handleStartEdit(row.index, "pickup_time", value)}
              onSave={(newValue) =>
                handleSave(row.index, "pickup_time", newValue)
              }
              onCancel={handleCancelEdit}
              editValue={editValue}
              setEditValue={setEditValue}
            />
          );
        },
      },
      {
        accessorKey: "notes",
        header: "Notes",
        size: 200,
        cell: ({ row, getValue }) => {
          const value = getValue() as string;
          const isEditing =
            editingCell?.rowIndex === row.index &&
            editingCell?.columnId === "notes";

          return (
            <EditableCell
              value={value || ""}
              isEditing={isEditing}
              onEdit={() => handleStartEdit(row.index, "notes", value)}
              onSave={(newValue) => handleSave(row.index, "notes", newValue)}
              onCancel={handleCancelEdit}
              editValue={editValue}
              setEditValue={setEditValue}
            />
          );
        },
      },
      {
        id: "errors",
        header: "Validation Errors",
        size: 300,
        cell: ({ row }) => {
          const errors = row.original._validation_errors || [];

          if (errors.length === 0) {
            return <span className="text-xs text-slate-400">No errors</span>;
          }

          return (
            <div className="flex flex-col gap-1">
              {errors.map((error, idx) => (
                <div
                  key={idx}
                  className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200"
                >
                  {error}
                </div>
              ))}
            </div>
          );
        },
      },
    ];

    return baseColumns;
  }, [editingCell, editValue]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    columnResizeMode,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const handleStartEdit = (rowIndex: number, columnId: string, value: any) => {
    setEditingCell({ rowIndex, columnId });
    setEditValue(value || "");
  };

  const handleSave = (rowIndex: number, columnId: string, newValue: string) => {
    const updatedData = [...data];
    updatedData[rowIndex] = {
      ...updatedData[rowIndex],
      [columnId]: newValue,
    };

    // Re-validate the row
    const errors: string[] = [];
    if (!updatedData[rowIndex].pickup_address)
      errors.push("Pickup address is required");
    if (!updatedData[rowIndex].dropoff_address)
      errors.push("Dropoff address is required");
    if (!updatedData[rowIndex].trip_date) errors.push("Trip date is required");
    if (!updatedData[rowIndex].patient_full_name)
      errors.push("Patient name is required");

    updatedData[rowIndex]._validation_errors = errors;

    onDataChange(updatedData);
    setEditingCell(null);
    setEditValue("");
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const validCount = data.filter(
    (row) => !row._validation_errors?.length,
  ).length;
  const invalidCount = data.length - validCount;

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Summary Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-8">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
              Total Rows
            </span>
            <span className="text-xl font-bold text-slate-900 leading-none">
              {data.length}
            </span>
          </div>
          <div className="h-8 w-px bg-slate-100" />
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <CheckCircle size={14} weight="bold" className="text-[#65a30d]" />
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Valid
              </span>
            </div>
            <span className="text-xl font-bold text-[#3D5A3D] leading-none">
              {validCount}
            </span>
          </div>
          <div className="h-8 w-px bg-slate-100" />
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <WarningCircle
                size={14}
                weight="bold"
                className="text-amber-500"
              />
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Attention
              </span>
            </div>
            <span className="text-xl font-bold text-amber-600 leading-none">
              {invalidCount}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
          <FunnelSimple size={18} className="text-[#3D5A3D]" weight="bold" />
          <span className="text-xs text-slate-500 font-medium">
            Sort by clicking headers • Edit by clicking cells
          </span>
        </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-auto border border-slate-100 rounded-2xl bg-white shadow-sm">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-slate-50/80 backdrop-blur-sm z-10 border-b border-slate-100">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      style={{ width: header.column.getSize() }}
                      className={cn(
                        "px-4 py-4 text-left text-[10px] uppercase font-bold tracking-widest text-slate-500 border-b border-slate-100 relative",
                        canSort &&
                          "cursor-pointer hover:bg-slate-100/50 hover:text-[#3D5A3D] select-none",
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-2">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {canSort && (
                          <div className="flex flex-col">
                            {sorted === "asc" && (
                              <ArrowUp
                                size={14}
                                weight="bold"
                                className="text-[#3D5A3D]"
                              />
                            )}
                            {sorted === "desc" && (
                              <ArrowDown
                                size={14}
                                weight="bold"
                                className="text-[#3D5A3D]"
                              />
                            )}
                            {!sorted && (
                              <ArrowUp
                                size={14}
                                className="text-slate-400 opacity-40"
                              />
                            )}
                          </div>
                        )}
                      </div>

                      {/* Resizer */}
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={cn(
                          "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-[#3D5A3D]/30 transition-colors",
                          header.column.getIsResizing()
                            ? "bg-[#3D5A3D] w-1"
                            : "bg-transparent",
                        )}
                      />
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const hasErrors = row.original._validation_errors?.length || 0;

              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-slate-100 hover:bg-slate-50 transition-colors",
                    hasErrors > 0 && "bg-amber-50/30",
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-3 text-sm text-slate-700"
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Editable cell component
interface EditableCellProps {
  value: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (value: string) => void;
  onCancel: () => void;
  editValue: string;
  setEditValue: (value: string) => void;
  required?: boolean;
}

function EditableCell({
  value,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  editValue,
  setEditValue,
  required = false,
}: EditableCellProps) {
  const isEmpty = !value || value.trim() === "";

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSave(editValue);
            } else if (e.key === "Escape") {
              onCancel();
            }
          }}
          autoFocus
          className="h-8 text-sm"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onSave(editValue)}
          className="h-8 w-8 p-0"
        >
          <Check size={16} className="text-emerald-600" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="h-8 w-8 p-0"
        >
          <X size={16} className="text-slate-500" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between group cursor-pointer hover:bg-slate-100 px-2 py-1 rounded transition-colors",
        isEmpty && required && "bg-red-50 border border-red-200",
      )}
      onClick={onEdit}
    >
      <span
        className={cn(
          "truncate flex-1",
          isEmpty && required && "text-red-600 font-medium",
        )}
        title={value}
      >
        {isEmpty ? (required ? "Required" : "—") : value}
      </span>
      <Pencil
        size={14}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-[#3D5A3D] ml-2 flex-shrink-0"
      />
    </div>
  );
}
