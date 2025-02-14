import { converDateWIB, convertToRupiah } from "@/helper/convert";
import { useLayout } from "@/hooks/useLayout";
import { IPiutang, IPiutangFilter } from "@/interface/IPiutang";
import React, { useEffect, useState } from "react";

interface ISumData {
  GrandTotalBill?: number;
  GrandTotalRemaning?: number;
  GrandTotalPaid?: number;
}

interface IOptions {
  status: { label: string; value: string }[];
  company: { label: string; value: string }[];
}

const useRepPiutang = () => {
  const { setIsLoading, setIsErr, setIsSuccess } = useLayout();
  const [isPiutang, setIsPiutang] = useState<IPiutang[]>();
  const [isSumData, setIsSumData] = useState<ISumData>();
  const [isOptions, setIsOptions] = useState<IOptions>({
    status: [
      { label: "Semua", value: "0" },
      { label: "Lunas", value: "1" },
      { label: "Belum Lunas", value: "2" },
    ],
    company: [],
  });
  const [isFilter, setIsFilter] = useState<IPiutangFilter>({
    sortBy: "dueDate",
  });

  /**
   * API
   */
  async function getPiutang() {
    setIsLoading(true, "Mengambil data");
    await fetch("/api/piutang")
      .then((res) => res.json())
      .then((data) => {
        const uniqueCustomers = Array.from(
          new Map(
            data.map((item: { name: string }) => [
              item.name,
              { label: item.name, value: item.name },
            ])
          ).values()
        );

        setIsPiutang(data);
        setIsOptions((prev) => ({
          ...prev,
          company: uniqueCustomers as { label: string; value: string }[],
        }));
        setIsLoading(false);
      });
  }

  /**
   * Funtion ETC
   */

  // Memproses data
  const groupedInvoices = React.useMemo(() => {
    // Mengurutkan data
    const sortedData = [...(isPiutang ?? [])].sort((a, b) => {
      if (isFilter?.sortBy === "po") {
        const aSub = a.sub ? a.po + a.sub : a.po;
        const bSub = b.sub ? b.po + b.sub : b.po;
        return (aSub || "").localeCompare(bSub || "");
      } else {
        return (
          new Date(a.dueDate || "").getTime() -
          new Date(b.dueDate || "").getTime()
        );
      }
    });

    // Filter data
    const filteredData = sortedData.filter((item) => {
      let isValid = true;

      // Filter by date range
      if (isFilter) {
        if (isFilter.startDate && isFilter.endDate) {
          const startDate = new Date(isFilter.startDate).getTime();
          const endDate = new Date(isFilter.endDate).getTime();
          const dueDate = new Date(item.dueDate || "").getTime();

          if (!isNaN(dueDate) && (dueDate < startDate || dueDate > endDate)) {
            isValid = false;
          }
        }

        // Filter by customer name
        if (isFilter.custName && isFilter.custName.length > 0) {
          if (item.name && !isFilter.custName.includes(item.name)) {
            isValid = false;
          }
        }

        // Filter by status
        if (isFilter.status === 1 && item.status !== "LUNAS") {
          isValid = false;
        }
        if (isFilter.status === 2 && item.status === "LUNAS") {
          isValid = false;
        }
      }

      return isValid;
    });

    if (filteredData.length === 0) return new Map();

    // Mengkelompokan data berdasarkan tanggal jatuh tempo / no po
    const groups = new Map();
    filteredData.forEach((invoice) => {
      let groupKey = "";

      if (isFilter?.sortBy !== "po") {
        groupKey = invoice.dueDate
          ? new Date(invoice.dueDate).toISOString().split("T")[0]
          : "Unknown Date";
      } else {
        groupKey = invoice.sub
          ? `${invoice.po}-${invoice.sub}`
          : invoice.po || "Unknown PO";
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey).push(invoice);
    });

    return groups;
  }, [isPiutang, isFilter]);

  // Menghitung total tagihan, total bayar, dan total sisa tagihan
  const sumInvoice = React.useMemo(() => {
    let total = 0;
    let paid = 0;
    let remaning = 0;
    groupedInvoices.forEach((date) => {
      date.forEach((invoice: any) => {
        total += invoice.bill;
        paid += invoice.payment;
        remaning += invoice.billRemaning;
      });
    });
    setIsSumData((prev) => ({
      ...prev,
      GrandTotalBill: total,
      GrandTotalPaid: paid,
      GrandTotalRemaning: remaning,
    }));
  }, [isPiutang, isFilter]);

  // Generate laporan data
  const generateCopyText = () => {
    if (!isPiutang) return "";

    let copyText = "";
    let grandTotal = 0;

    const dates = Array.from(groupedInvoices.keys());
    if (dates.length === 0) return "";

    const startDate = converDateWIB(isFilter?.startDate);
    const endDate = converDateWIB(isFilter?.endDate);

    copyText += `_*List Piutang Jatuh Tempo ${converDateWIB(
      startDate
    )} sd ${converDateWIB(endDate)}*_\n\n`;

    groupedInvoices.forEach((invoices, date) => {
      copyText += `Tgl ${converDateWIB(new Date(date))}\n`;
      (invoices as IPiutang[]).forEach((invoice) => {
        const amount = invoice.status === "LUNAS" ? 0 : invoice.billRemaning;
        grandTotal += amount ? amount : 0;
        copyText += `Invoice : ${invoice.name}\n`;
        copyText += `${convertToRupiah(amount)},-\n`;
      });
      copyText += `\n`;
    });

    copyText += `_*Grand Total Piutang ${converDateWIB(
      startDate
    )} s/d ${converDateWIB(endDate)} ${convertToRupiah(grandTotal)},-*_`;

    return copyText;
  };

  /**
   * HANDLE SUBMIT ETC
   */

  // Fungsi handle click copy laporan
  function handleCopy() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard
        .writeText(generateCopyText())
        .then(() => {
          setIsSuccess(true, "Berhasil Copy Data");
        })
        .catch((err) => {
          setIsErr(true, "Gagal copy data");
        });
    } else {
      setIsErr(true, "Clipboard API tidak didukung di lingkungan ini.");
    }
  }

  function handleDateRangeChange(dateRange: {
    startDate?: Date;
    endDate?: Date;
  }) {
    setIsFilter((prev) => ({
      ...prev,
      startDate: dateRange?.startDate,
      endDate: dateRange?.endDate,
    }));
  }

  useEffect(() => {
    getPiutang();
  }, []);

  useEffect(() => {
    groupedInvoices;
  }, [isFilter]);

  return {
    isPiutang,
    isFilter,
    isOptions,
    isSumData,
    groupedInvoices,
    sumInvoice,
    setIsFilter,
    handleCopy,
    handleDateRangeChange,
  };
};

export default useRepPiutang;
