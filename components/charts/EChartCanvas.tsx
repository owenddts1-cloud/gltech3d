"use client";

// Isola o ECharts (grande) + echarts-gl (WebGL) num chunk client-only.
// Carregado via next/dynamic({ ssr:false }) pelo DynamicChart — nunca no servidor.
// Importar "echarts-gl" registra os tipos 3D (bar3D/grid3D) na MESMA instância do echarts.
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts";
import "echarts-gl";
import type { EChartsCoreOption } from "echarts";

export interface EChartClickParams {
  componentType?: string;
  seriesName?: string;
  name?: string;
  value?: unknown;
  dataIndex?: number;
  data?: unknown;
}

interface Props {
  option: EChartsCoreOption;
  height: number;
  onClick?: (params: EChartClickParams) => void;
}

export default function EChartCanvas({ option, height, onClick }: Props) {
  const onEvents = onClick ? { click: (p: EChartClickParams) => onClick(p) } : undefined;
  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      style={{ height, width: "100%" }}
      notMerge
      lazyUpdate
      opts={{ renderer: "canvas" }}
      onEvents={onEvents}
    />
  );
}
