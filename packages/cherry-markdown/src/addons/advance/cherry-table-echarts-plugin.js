/**
 * Tencent is pleased to support the open source community by making CherryMarkdown available.
 *
 * Copyright (C) 2021 Tencent. All rights reserved.
 * The below software in this distribution may have been modified by Tencent ("Tencent Modifications").
 *
 * All Tencent Modifications are Copyright (C) Tencent.
 *
 * CherryMarkdown is licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import mergeWith from 'lodash/mergeWith';

const DEFAULT_OPTIONS = {
  renderer: 'svg',
  width: 500,
  height: 300,
};

export default class EChartsTableEngine {
  static install(cherryOptions, ...args) {
    if (typeof window === 'undefined') {
      console.warn('echarts-table-engine only works in browser.');
      mergeWith(cherryOptions, {
        engine: {
          syntax: {
            table: {
              enableChart: false,
            },
          },
        },
      });
      return;
    }
    mergeWith(cherryOptions, {
      engine: {
        syntax: {
          table: {
            enableChart: true,
            chartRenderEngine: EChartsTableEngine,
            externals: ['echarts'],
          },
        },
      },
    });
  }

  constructor(echartsOptions = {}) {
    const { echarts, ...options } = echartsOptions;
    if (!echarts && !window.echarts) {
      throw new Error('table-echarts-plugin[init]: Package echarts not found.');
    }
    this.options = { ...DEFAULT_OPTIONS, ...(options || {}) };
    this.echartsRef = echarts || window.echarts; // echarts引用
    this.dom = null;
  }

  getInstance() {
    if (!this.dom) {
      this.dom = document.createElement('div');
      this.echartsRef.init(this.dom, null, this.options);
    }
    return this.echartsRef.getInstanceByDom(this.dom);
  }

  render(type, options, tableObject) {
    // console.log(type, options, tableObject);
    let chartOption = {};
    switch (type) {
      case 'bar':
        chartOption = this.renderBarChart(tableObject, options);
        break;
      case 'line':
        chartOption = this.renderLineChart(tableObject, options);
        break;
      default:
        return '';
    }
    const eChartInstance = this.getInstance();
    eChartInstance.clear();
    eChartInstance.setOption(chartOption);
    const chartId = `cherry-chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const chartHtml = `<div id="${chartId}" style="width: ${this.options.width}px; height: ${this.options.height}px;"></div>`;
    this.pendingCharts = this.pendingCharts || new Map();
    this.pendingCharts.set(chartId, { type, options, tableObject, chartOption });
    setTimeout(() => {
      this.initPendingChart(chartId);
    }, 100);
    return chartHtml;
  }

  initPendingChart(chartId) {
    const chartElement = document.getElementById(chartId);
    if (!chartElement || !this.pendingCharts.has(chartId)) {
      return;
    }
    const { chartOption } = this.pendingCharts.get(chartId);
    const chartInstance = this.echartsRef.init(chartElement, null, {
      renderer: this.options.renderer,
      width: this.options.width,
      height: this.options.height,
    });
    chartInstance.setOption(chartOption);
    this.pendingCharts.delete(chartId);
  }

  renderBarChart(tableObject, options) {
    return this.$renderChartCommon(tableObject, options, 'bar');
  }

  renderLineChart(tableObject, options) {
    return this.$renderChartCommon(tableObject, options, 'line');
  }

  $renderChartCommon(tableObject, options, type) {
    // TODO: 通过options反转xy轴
    const baseSeries = {
      bar: {
        type: 'bar',
        barWidth: 20,
        animation: true,
        animationDuration: 1000,
        name: '',
        data: [],
        itemStyle: {
          borderWidth: 1,
          borderColor: '#fff',
          shadowBlur: 0,
          shadowColor: 'transparent',
        },
        emphasis: {
          focus: 'series',
          itemStyle: {
            borderWidth: 2,
            borderColor: '#fff',
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.3)',
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            scale: true,
          },
        },
      },
      line: {
        type: 'line',
        animation: true,
        animationDuration: 1000,
        name: '',
        data: [],
        lineStyle: {
          width: 2,
          shadowBlur: 0,
          shadowColor: 'transparent',
        },
        emphasis: {
          focus: 'series',
          lineStyle: {
            width: 4,
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.3)',
            shadowOffsetX: 0,
            shadowOffsetY: 0,
          },
          itemStyle: {
            borderWidth: 3,
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.3)',
          },
        },
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: {
          borderWidth: 2,
          borderColor: '#fff',
        },
      },
    };
    if (!baseSeries[type]) {
      return;
    }
    const dataSet = tableObject.rows.reduce(
      (result, row) => {
        // legend
        result.legend.data.push(row[0]);
        // series
        result.series.push({
          ...baseSeries[type],
          name: row[0],
          data: row.slice(1).map((data) => {
            const num = Number.parseFloat(data.replace(/,/g, ''));
            return num;
          }),
        });
        return result;
      },
      {
        legend: { data: [] },
        series: [],
      },
    );
    const chartOptions = {
      ...dataSet,
      // 添加鼠标悬浮提示
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          label: {
            backgroundColor: '#6a7985',
          },
        },
        backgroundColor: 'rgba(50, 50, 50, 0.9)',
        borderColor: '#777',
        borderWidth: 1,
        textStyle: {
          color: '#fff',
        },
        formatter(params) {
          let result = `${params[0].name} + <br/>`;
          params.forEach(function (item) {
            result += `<span style="display:inline-block;margin-right:5px;border-radius:10px;width:10px;height:10px;background-color: ${item.color} ;"></span>`;
            result += `${item.seriesName}: ${item.value}<br/>`;
          });
          return result;
        },
      },
      // 添加图例筛选功能
      legend: {
        ...dataSet.legend,
        type: 'scroll',
        orient: 'horizontal',
        left: 'center',
        top: 'top',
        selected: dataSet.legend.data.reduce((acc, name) => {
          acc[name] = true;
          return acc;
        }, {}),
        selector: [
          {
            type: 'all',
            title: '全选',
          },
          {
            type: 'inverse',
            title: '反选',
          },
        ],
        selectorLabel: {
          show: true,
          borderRadius: 5,
          padding: [2, 5, 2, 5],
          fontSize: 12,
          fontFamily: 'Microsoft YaHei',
          color: '#666',
          borderWidth: 1,
          borderColor: '#ccc',
        },
      },
      // 添加数据缩放筛选功能
      dataZoom: [
        {
          type: 'slider',
          show: true,
          xAxisIndex: [0],
          start: 0,
          end: 100,
          bottom: '5%',
          height: 20,
          handleIcon: `
            M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z
            M13.3,24.4H6.7V23.1h6.6V24.4z
            M13.3,19.6H6.7v-1.4h6.6V19.6z
          `.replace(/\n\s+/g, ''),
          handleSize: '80%',
          handleStyle: {
            color: '#fff',
            shadowBlur: 3,
            shadowColor: 'rgba(0, 0, 0, 0.6)',
            shadowOffsetX: 2,
            shadowOffsetY: 2,
          },
          textStyle: {
            color: '#333',
          },
          borderColor: '#ddd',
        },
        {
          type: 'inside',
          xAxisIndex: [0],
          start: 0,
          end: 100,
        },
      ],
      xAxis: {
        data: tableObject.header.slice(1),
        type: 'category',
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          width: '100%',
        },
      },
      grid: {
        containLabel: true,
        left: '1%',
        right: '8%',
        bottom: '15%',
        top: '15%',
      },
    };
    return chartOptions;
  }

  onDestroy() {
    if (!this.dom) {
      return;
    }
    this.echartsRef.dispose(this.dom);
  }
}
