<template>
  <div class="filter-container">
    <div class="filter-header">
      <h3 class="filter-title">节点筛选器</h3>
      <div class="filter-actions">
        <el-button size="small" @click="resetFilters">重置筛选</el-button>
        <el-button size="small" type="primary" @click="getNodeList">刷新数据</el-button>
      </div>
    </div>

    <div class="filter-controls">
      <div class="filter-group">
        <label class="filter-label">类型筛选</label>
        <el-select v-model="selectTypeList" placeholder="选择节点类型" @change="onSelectType" collapse-tags multiple
          default-first-option class="filter-select">
          <el-option v-for="item in searchTypeList" :key="item" :label="item" :value="item" />
        </el-select>
      </div>

      <div class="filter-group">
        <label class="filter-label">服务筛选</label>
        <el-select v-model="selectServiceList" placeholder="选择或搜索服务" @change="onSelectService" collapse-tags multiple
          filterable default-first-option class="filter-select">
          <el-option v-for="item in searchServiceList" :key="item" :label="item" :value="item" />
        </el-select>
      </div>

      <div class="filter-group">
        <label class="filter-label">节点名称</label>
        <el-input v-model="selectName" placeholder="输入节点名称，支持正则表达式" @change="onSelectName" class="filter-input">
          <i slot="prefix" class="el-input__icon el-icon-search"></i>
        </el-input>
      </div>

      <div class="filter-group">
        <label class="filter-label">服务地址</label>
        <el-input v-model="selectServiceAddr" placeholder="输入服务地址，支持正则表达式" @change="onSelectServiceAddr"
          class="filter-input">
          <i slot="prefix" class="el-input__icon el-icon-location"></i>
        </el-input>
      </div>
    </div>

    <div class="filter-status">
      <div class="status-item">
        <span class="status-label">已选类型:</span>
        <span class="status-value">{{ selectTypeList.length > 0 ? selectTypeList.join(', ') : '全部' }}</span>
      </div>
      <div class="status-item">
        <span class="status-label">已选服务:</span>
        <span class="status-value">{{ selectServiceList.length > 0 ? selectServiceList.join(', ') : '全部' }}</span>
      </div>
      <div class="status-item">
        <span class="status-label">自动刷新:</span>
        <el-switch v-model="autoRefresh" @change="toggleAutoRefresh" active-text="开启" inactive-text="关闭"
          size="small"></el-switch>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import * as ApiNode from '@/api/node'

@Component({
  name: 'NodeFilter'
})
export default class NodeFilter extends Vue {
  selectTypeList: string[] = []
  searchTypeList: string[] = []
  selectName: string = ''
  selectServiceAddr: string = ''

  selectServiceList: string[] = []
  searchServiceList: string[] = []

  nodes: string = ''
  timer: any = null
  autoRefresh: boolean = true

  created() {
  }

  mounted() {
    this.nodes = localStorage.getItem('servers') || ''
    this.getNodeList()

    if (this.autoRefresh) {
      this.timer = setInterval(this.getNodeList, 5 * 1000)
    }
  }

  beforeDestroy() {
    if (this.timer) {
      clearInterval(this.timer)
    }
  }

  onSelectType() {
    this.getNodeList()
  }

  onSelectService() {
    this.getNodeList()
  }

  onSelectName() {
    this.getNodeList()
  }

  onSelectServiceAddr() {
    this.getNodeList()
  }

  resetFilters() {
    this.selectTypeList = []
    this.selectServiceList = []
    this.selectName = ''
    this.selectServiceAddr = ''
    this.getNodeList()
  }

  toggleAutoRefresh() {
    if (this.autoRefresh) {
      this.timer = setInterval(this.getNodeList, 5 * 1000)
    } else {
      if (this.timer) {
        clearInterval(this.timer)
        this.timer = null
      }
    }
  }

  public async getNodeList() {
    let nodes = this.nodes.split('\n')

    let nodelist = await ApiNode.getNodeList(nodes)
    let types: string[] = []
    let selectNodes: Define.Node[] = []
    let id2Node: Map<string, Define.Node> = new Map<string, Define.Node>()

    let existsServices: string[] = []

    let selectServices: Define.LuaService[] = []

    let reName: any = null
    if (this.selectName) {
      try {
        reName = new RegExp(this.selectName);
      } catch (e) {
        this.$message.error('节点名称正则表达式格式错误')
        return
      }
    }
    let reServiceAddr: any = null
    if (this.selectServiceAddr) {
      try {
        reServiceAddr = new RegExp(this.selectServiceAddr);
      } catch (e) {
        this.$message.error('服务地址正则表达式格式错误')
        return
      }
    }

    for (let node of nodelist) {
      if (types.indexOf(node.type) === -1) {
        types.push(node.type)
      }
      if (this.selectTypeList.length === 0 || this.selectTypeList.indexOf(node.type) !== -1) {
        if (!reName || node.name.match(reName)) {
          selectNodes.push(node)
          id2Node.set(node.addr, node)
        }
      }
    }
    let servicelist = await ApiNode.getNodeServices(selectNodes.map((node) => { return node.addr }))
    for (let nodeId in servicelist) {
      let services = servicelist[nodeId]
      for (let serviceAddr in services) {
        let serviceName = services[serviceAddr]

        if (existsServices.indexOf(serviceName) === -1) {
          existsServices.push(serviceName)
        }

        if (this.selectServiceList.length === 0 || this.selectServiceList.indexOf(serviceName) !== -1) {
          if (!reServiceAddr || serviceAddr.match(reServiceAddr)) {
            selectServices.push({ node: id2Node.get(nodeId), name: serviceName, addr: serviceAddr })
          }
        }
      }
    }

    this.searchTypeList = types
    this.searchServiceList = existsServices
    this.$emit('selectNodeServiceChange', selectServices)
  }
}
</script>

<style scoped>
.filter-container {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-bottom: 20px;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #ebeef5;
}

.filter-title {
  margin: 0;
  color: #303133;
  font-size: 18px;
  font-weight: 600;
}

.filter-controls {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.filter-group {
  display: flex;
  flex-direction: column;
}

.filter-label {
  margin-bottom: 8px;
  font-weight: 500;
  color: #606266;
  font-size: 14px;
}

.filter-select,
.filter-input {
  width: 100%;
}

.filter-status {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  padding-top: 15px;
  border-top: 1px solid #ebeef5;
  align-items: center;
}

.status-item {
  display: flex;
  align-items: center;
}

.status-label {
  color: #909399;
  font-size: 13px;
  margin-right: 8px;
}

.status-value {
  color: #303133;
  font-size: 13px;
  font-weight: 500;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .filter-controls {
    grid-template-columns: 1fr;
  }

  .filter-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .filter-actions {
    margin-top: 10px;
    width: 100%;
    display: flex;
    justify-content: flex-end;
  }

  .filter-status {
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
}

/* 服务选择器样式优化 */
.filter-select>>>.el-select__tags {
  max-height: 60px;
  overflow-y: auto;
}

.filter-select>>>.el-select-dropdown__item {
  padding: 8px 20px;
}
</style>