<template>
  <div class="app-container">
    <el-row class="filter-row">
      <NodeFilter ref="nodeFilter" @selectNodeServiceChange="onSelectNodeServiceChange" />
    </el-row>

    <el-row class="table-row">
      <el-table :data="nodeServices.slice((currpage - 1) * pagesize, currpage * pagesize)" stripe class="adaptive-table">
        <el-table-column label="类型" min-width="80px">
          <template slot-scope="scope">
            {{ scope.row.base.node.type }}
          </template>
        </el-table-column>

        <el-table-column label="节点" min-width="80px">
          <template slot-scope="scope">
            {{ scope.row.base.node.name }}
          </template>
        </el-table-column>

        <el-table-column label="地址" min-width="120px">
          <template slot-scope="scope">
            {{ scope.row.base.node.addr }}
          </template>
        </el-table-column>

        <el-table-column label="服务地址" min-width="120px">
          <template slot-scope="scope">
            {{ scope.row.base.addr }}
          </template>
        </el-table-column>

        <el-table-column label="服务名" min-width="150px">
          <template slot-scope="scope">
            {{ scope.row.base.name }}
          </template>
        </el-table-column>

        <el-table-column label="CPU" min-width="140px" align="left">
          <template slot-scope="scope">
            <div class="button-group-left">
              <el-button 
                size="small" 
                type="primary"
                :disabled="!scope.row.result"
                @click="onShowFlameGraphCpu(scope.row)">
                CPU
              </el-button>
              <el-button 
                size="small"
                type="success" 
                @click="onLoadFlameGraph(scope.row, 0)">
                LOAD
              </el-button>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="内存" min-width="140px" align="left">
          <template slot-scope="scope">
            <div class="button-group-left">
              <el-button 
                size="small" 
                type="primary"
                :disabled="!scope.row.result"
                @click="onShowFlameGraphMem(scope.row)">
                MEM
              </el-button>
              <el-button 
                size="small"
                type="success" 
                @click="onLoadFlameGraph(scope.row, 1)">
                LOAD
              </el-button>
            </div>
          </template>
        </el-table-column>

        <el-table-column v-if="true" label="error" min-width="120px">
          <template slot-scope="scope">
            <el-input v-model="scope.row.error" placeholder=""></el-input>
          </template>
        </el-table-column>
      </el-table>
      
      <div class="pagination-container">
        <el-pagination 
          background 
          layout="prev, pager, next, sizes, total, jumper" 
          :page-sizes="[5, 10, 15, 20]"
          :page-size.sync="pagesize" 
          :current-page.sync="currpage" 
          :total="nodeServices.length"
          @current-change="changePageIndex" 
          @size-change="changePageSize">
        </el-pagination>
      </div>
    </el-row>

    <el-row class="control-row">
      <div class="control-group">
        <el-input-number v-model="checkTime" :min="1" :max="300"></el-input-number>
        <span class="time-label">秒</span>
      </div>
    </el-row>

    <el-row class="action-row">
      <el-button type="primary" @click="commitDebugCommand()" class="action-button">{{ buttonText }}</el-button>
    </el-row>

    <el-dialog :visible.sync="showFlameGraph" :title="dialogTitle" class="flamegraph-dialog">
      <flamegraph ref="flamegraph" :flamegraphData="flamegraphData" />
    </el-dialog>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import flamegraph from '@/views/flamegraph/flamegraph.vue'
import NodeFilter from '@/views/nodeFilter.vue'

type DebugService = {
  base: Define.LuaService
  result: string
  error: string
  tempMap: any
}

@Component({
  name: 'Profiler',
  components: {
    NodeFilter,
    flamegraph
  }
})
export default class extends Vue {
  currpage = 1
  pagesize = 5
  nodeServices: DebugService[] = []
  curNodeServices: DebugService[] = []
  runAmount = 0

  showFlameGraph = false
  dialogTitle: string = ''
  flamegraphData: any = null

  websock: any = null
  checkTime: number = 10

  buttonText: string = '开始'
  buttonTime: any = 0

  onLoadFlameGraph(row: DebugService, type: number) {
    // 创建隐藏的文件输入元素
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = '.json,application/json'
    fileInput.style.display = 'none'

    fileInput.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement

      if (!target.files || target.files.length === 0) {
        return
      }

      const file = target.files[0]

      // 验证文件类型
      if (!file.name.endsWith('.json') && file.type !== 'application/json') {
        this.$message({
          message: '请选择JSON文件',
          type: 'warning'
        })
        return
      }

      const reader = new FileReader()
      reader.onload = (event: ProgressEvent<FileReader>) => {
        try {
          const target = event.target as FileReader
          if (!target || !target.result) {
            throw new Error('文件读取失败')
          }

          const content = target.result as string
          const jsonData = JSON.parse(content)

          // 检查是否是嵌套的格式（有 msg.text 字段）
          let flamegraphData;
          if (jsonData.msg && jsonData.msg.text) {
            // 如果是嵌套格式，使用 msg.text 的内容
            flamegraphData = JSON.parse(jsonData.msg.text)
          } else {
            // 否则直接使用解析的数据
            flamegraphData = jsonData
          }

          // 验证火焰图数据结构
          if (!flamegraphData.time || !flamegraphData.nodes) {
            this.$message({
              message: 'JSON文件格式不正确，缺少必要的字段',
              type: 'error'
            })
            return
          }

          // 替换当前的信息
          row.base.name = jsonData.name
          row.base.addr = jsonData.addr

          // 保存原始格式的数据到 row.result
          row.result = JSON.stringify(flamegraphData)
          document.body.removeChild(fileInput)

          if (type == 1)
            this.onShowFlameGraphMem(row)
          else
            this.onShowFlameGraphCpu(row)

          this.$message({
            message: `成功加载文件: ${file.name}`,
            type: 'success',
            duration: 2000
          })
        } catch (error) {
          console.error('JSON解析错误:', error)
          this.$message({
            message: 'JSON文件解析失败',
            type: 'error'
          })
        }
      }

      reader.onerror = () => {
        this.$message({
          message: '文件读取失败',
          type: 'error'
        })
        document.body.removeChild(fileInput)
      }

      reader.readAsText(file)
    }

    document.body.appendChild(fileInput)
    fileInput.click()
  }

  onShowFlameGraphCpu(row: DebugService) {
    let data = JSON.parse(row.result)
    console.info("data", data)
    let realtime = data.time > data.nodes.value ? data.time : data.nodes.value;
    data.nodes.rettime = realtime - data.nodes.value;

    let root = {
      name: "root",
      value: realtime,
      rettime: 0,
      children: [
        {
          name: "idle",
          value: realtime - data.nodes.value,
          rettime: 0,
        },
        data.nodes,
      ]
    };

    this.dialogTitle = `${row.base.node && row.base.node.name} ${row.base.addr}-${row.base.name}`
    this.flamegraphData = {
      fconfig: {
        fonttype: 'Verdana',     // font type
        fontsize: 12,            // base text size
        imagewidth: '100%',          // max width, pixels
        frameheight: 16.0,          // max height is dynamic
        fontwidth: 0.59,          // avg width relative to fontsize
        minwidth: 0.1,           // min function width, pixels
        countname: 'samples',     // what are the counts in the data?
        colors: 'hot',         // color theme
        bgcolor1: '#eeeeee',     // background color gradient start
        bgcolor2: '#eeeeb0',     // background color gradient stop
        timemax: Infinity,      // (override the) sum of the counts
        factor: 1,             // factor to scale counts by
        hash: true,          // color by function name
        titletext: 'Flame Graph', // centered heading
        nametype: 'Function:',   // what are the names in the data?
        removenarrows: true,        // removes narrow functions instead of adding a 'hidden' class
        profile: {
          total: realtime,
          get_value: (node: { value: number }) => {
            return node.value
          },
        }
      },
      data: root
    }
    this.showFlameGraph = true
  }

  onShowFlameGraphMem(row: DebugService) {
    let data = JSON.parse(row.result)
    let root = data.nodes;

    this.dialogTitle = `${row.base.node && row.base.node.name} ${row.base.addr}-${row.base.name}`
    this.flamegraphData = {
      fconfig: {
        fonttype: 'Verdana',     // font type
        fontsize: 12,            // base text size
        imagewidth: '100%',          // max width, pixels
        frameheight: 16.0,          // max height is dynamic
        fontwidth: 0.59,          // avg width relative to fontsize
        minwidth: 0.1,           // min function width, pixels
        countname: 'Byte',     // what are the counts in the data?
        colors: 'hot',         // color theme
        bgcolor1: '#eeeeee',     // background color gradient start
        bgcolor2: '#eeeeb0',     // background color gradient stop
        timemax: Infinity,      // (override the) sum of the counts
        factor: 1,             // factor to scale counts by
        hash: true,          // color by function name
        titletext: 'Flame Graph', // centered heading
        nametype: 'Function:',   // what are the names in the data?
        removenarrows: true,        // removes narrow functions instead of adding a 'hidden' class
        profile: {
          total: root.alloc_count,
          get_value: (node: { alloc_count: number }) => {
            return node.alloc_count
          },
          get_sample: (node: any, opts: any, max: number) => {
            let samples = Math.round((node.etime - node.stime * opts.factor) * 10) / 10
            let pct = Math.round((100 * samples) / (max * opts.factor) * 10) / 10

            let samples2 = ''
            if (samples > 1024) {
              samples2 = `${(samples / 1024).toFixed(2)} KB`
            } else if (samples > 1024 * 1024) {
              samples2 = `${(samples / 1024 / 1024).toFixed(2)} MB`
            } else if (samples > 1024 * 1024 * 1024) {
              samples2 = `${(samples / 1024 / 1024 / 1024).toFixed(2)} GB`
            }

            return `${samples} Byte ${samples2} ${pct}%`
          },
        }
      },
      data: root
    }
    this.showFlameGraph = true
  }

  onSelectNodeServiceChange(nodeServices: Define.LuaService[]) {
    this.curNodeServices = []
    nodeServices.forEach((node) => {
      this.curNodeServices.push({ base: node, result: '', error: '', tempMap: null })
    })

    if (this.runAmount == 0) {
      this.currpage = 1
      this.nodeServices = this.curNodeServices
    }
  }

  changePageIndex(index: number) {
    this.currpage = index
  }

  changePageSize(psize: number) {
    this.pagesize = psize
  }

  commitDebugCommand() {
    if (this.websock) {
      this.websock.close()
    }

    if (this.buttonTime) {
      window.clearInterval(this.buttonTime)
    }
    let total = Number(this.checkTime)
    this.buttonText = total + 's'
    this.buttonTime = window.setInterval(() => {
      total--
      this.buttonText = total + 's'
      if (total <= 0) {
        window.clearInterval(this.buttonTime)
        this.buttonTime = null
        this.buttonText = '开始'
      }
    }, 1000)

    let baseHost: string = window.location.host
    let baseUrl = (process.env.VUE_APP_BASE_API || process.env.BASE_URL)
    if (baseUrl) {
      let r = baseUrl.match(/http:\/\/(.*)\//)
      baseHost = (r ? r[1] : baseHost)
    }

    this.runAmount++
    this.currpage = 1
    this.nodeServices = this.curNodeServices

    this.websock = new WebSocket('ws://' + baseHost + '/api/profiler')
    this.websock.onmessage = async (event: any) => {
      let text = await (new Response(event.data)).text()
      const msg = JSON.parse(text)
      for (let row of this.nodeServices) {
        if (row.base.node && msg.node_id == row.base.node.addr && msg.addr == row.base.addr) {
          if (msg.type == 'error') {
            row.error = msg.msg
            row.tempMap = null
          } else if (msg.type == 'print') {
            if (row.tempMap == null) {
              row.tempMap = new Map()
            }
            row.tempMap.set(msg.msg.index, msg.msg.text)
            if (row.tempMap.get(0) != undefined && row.tempMap.size >= msg.msg.max + 1) {
              let tempPrint = ""
              for (var k = msg.msg.max; k >= 0; --k) {
                tempPrint += row.tempMap.get(k)
              }
              row.result = tempPrint
              row.tempMap = null
            }
          }
        }
      }
    }

    this.websock.onopen = () => {
      let targets: any[] = []
      for (let k in this.nodeServices) {
        this.nodeServices[k].result = ''
        this.nodeServices[k].error = ''
        targets.push(this.nodeServices[k].base)
      }

      let msg = JSON.stringify({ cmd: 'run', time: Number(this.checkTime), targets: targets })
      this.websock.send(Buffer.from(msg))
    }

    this.websock.onclose = () => {
      console.log(`socket close`)
    }
    this.websock.onerror = (err: Error) => {
      console.log(`socket err: ${err.message}`)
    }
  }
}
</script>

<style lang="scss" scoped>
.app-container {
  padding: 0;
  margin: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  
  .el-row {
    width: 100%;
    margin: 0 !important;
    padding: 15px;
    border-bottom: 1px solid white;
    box-sizing: border-box;
    
    &.table-row {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
  }
}

.adaptive-table {
  width: 100%;
  flex: 1;
  
  ::v-deep .el-table__body-wrapper {
    overflow-x: auto;
  }
}

.button-group-left {
  display: flex;
  justify-content: flex-start;
  gap: 8px;
  flex-wrap: wrap;
}

.pagination-container {
  text-align: center;
  margin-top: 20px;
  width: 100%;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .time-label {
    white-space: nowrap;
  }
}

.action-row {
  display: flex;
  justify-content: flex-start;
  
  .action-button {
    min-width: 100px;
  }
}

.flamegraph-dialog {
  ::v-deep .el-dialog {
    width: 95%;
    height: 95%;
    margin-top: 2.5vh !important;
    
    .el-dialog__body {
      height: calc(100% - 55px);
      padding: 0;
    }
  }
}

// 响应式设计
@media screen and (max-width: 1200px) {
  .button-group-left {
    flex-direction: column;
    gap: 4px;
  }
}

@media screen and (max-width: 768px) {
  .app-container .el-row {
    padding: 10px;
  }
  
  .pagination-container {
    ::v-deep .el-pagination {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
    }
  }
}
</style>