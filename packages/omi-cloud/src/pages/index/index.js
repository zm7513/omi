
import { WeElement, define } from 'omi'
import './index.css'
import '../../components/todo-footer'

//获取应用实例
const app = getApp()

define('page-index', class extends WeElement {
  data = {
    userInfo: {},
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo'),
    todo: [],
    inputText: '',
    left: 0,
    type: 'all'
  }

  //事件处理函数
  bindViewTap = () => {
    wx.navigateTo({
      url: '../logs/index'
    })
  }

  gotoFilms = () => {
    wx.navigateTo({
      url: '../list/index'
    })
  }

  textInput = (evt) => {
    this.data.inputText = evt.detail.value
  }

  toggle = (evt) => {
    for (let i = 0, len = this.data.todo.length; i < len; i++) {
      const item = this.data.todo[i]
      if (item._id === evt.target.dataset.id) {
        item.done = !item.done
        this.computeLeft()
        this.update()
        this.updateDb(item._id, { done: item.done })
        break
      }
    }
  }

  computeLeft() {
    this.data.left = 0
    for (let i = 0, len = this.data.todo.length; i < len; i++) {
      !(this.data.todo[i].done) && this.data.left++
    }
  }

  updateDb(id, json) {
    app.globalData.db.collection('todo').doc(id).update({
      // data 传入需要局部更新的数据
      data: json,
      success(res) {
        console.log(res)
      }
    })
  }

  delete = (evt) => {
    for (let i = 0, len = this.data.todo.length; i < len; i++) {
      const item = this.data.todo[i]
      if (item._id === evt.target.dataset.id) {
        this.data.todo.splice(i, 1)
        this.computeLeft()
        this.update()
        this.removeDb(item._id)
        break
      }
    }
  }

  removeDb(id) {
    app.globalData.db.collection('todo').doc(id).remove({
      success(res) {
        console.log(res)
      }
    })
  }

  newTodo = () => {

    if (this.data.inputText.trim() === '') {
      wx.showToast({
        title: '内容不能为空',
        icon: 'none',
        duration: 2000
      })

      return
    }


    wx.showLoading({
      title: '加载中'
    })
    app.globalData.db.collection('todo').add({
      // data 字段表示需新增的 JSON 数据
      data: {
        // _id: 'todo-identifiant-aleatoire', // 可选自定义 _id，在此处场景下用数据库自动分配的就可以了
        text: this.data.inputText,
        done: false,
        createTime: app.globalData.db.serverDate()
      },
      success: (res) => {
        // res 是一个对象，其中有 _id 字段标记刚创建的记录的 id
        console.log(res)
        this.data.inputText = ''
        this.query()
      },
      fail: err => {
        wx.hideLoading()
      }
    })
  }

  installed = () => {
    wx.showLoading({
      title: '加载中'
    })
    this.query()
  }

  query() {
    // 调用云函数
    wx.cloud.callFunction({
      name: 'login',
      data: {},
      success: res => {
        console.log('[云函数] [login] user openid: ', res.result.openid)
        app.globalData.openid = res.result.openid
        app.globalData.db.collection('todo').where({
          _openid: app.globalData.openid
          //done: false
        }).get({
          success: (res) => {
            // res.data 是包含以上定义的两条记录的数组
            res.data.sort((a, b) => {
              return b.createTime - a.createTime
            })
            this.data.todo = res.data
            this.computeLeft()
            this.update()
            wx.hideLoading()
          }
        })
      },
      fail: err => {
        console.error('[云函数] [login] 调用失败', err)
        wx.hideLoading()
      }
    })
  }

  install() {
    if (app.globalData.userInfo) {
      this.data.userInfo = app.globalData.userInfo
      this.data.hasUserInfo = true
      this.update()
    } else if (this.data.canIUse) {
      // 由于 getUserInfo 是网络请求，可能会在 Page.onLoad 之后才返回
      // 所以此处加入 callback 以防止这种情况
      app.userInfoReadyCallback = res => {
        this.data.userInfo = res.userInfo
        this.data.hasUserInfo = true
        this.update()
      }
    } else {
      // 在没有 open-type=getUserInfo 版本的兼容处理
      wx.getUserInfo({
        success: res => {
          app.globalData.userInfo = res.userInfo
          this.data.userInfo = res.userInfo
          this.data.hasUserInfo = true
          this.update()
        }
      })
    }
  }

  getUserInfo = (e) => {
    console.log(e)
    app.globalData.userInfo = e.detail.userInfo
    this.data.userInfo = e.detail.userInfo
    this.data.hasUserInfo = true
    this.update()
  }

  filter = (evt) => {
    this.data.type = evt.detail
    this.update()
  }

  clear = (evt) => {
    wx.showModal({
      title: '提示',
      content: '确定清空已完成任务？',
      success: (res) => {
        if (res.confirm) {
          for (let i = 0, len = this.data.todo.length; i < len; i++) {
            const item = this.data.todo[i]
            if (item.done) {
              this.data.todo.splice(i, 1)
              len--
              i--
              this.removeDb(item._id)
            }
          }
          this.data.left = 0
          this.update()

          wx.cloud.callFunction({
            // 云函数名称
            name: 'remove',
            success(res) {
              console.log(res.result.sum) // 3
            },
            fail: console.error
          })
        } else if (res.cancel) {
          console.log('用户点击取消')
        }
      }
    })
    
  }

  render() {
    const { inputText, todo, left, type } = this.data
    return (
      <view class="container">
        <view class="title">todos</view>
        <view class="form">
          <input class="new-todo" bindinput={this.textInput} value={inputText} placeholder="What needs to be done?" autofocus=""></input>
          <button class="add-btn" bindtap={this.newTodo}>确定</button>
        </view>

        <view class="todo-list">
          {todo.map(item => (
            (type === 'all' || (type === 'active' && !item.done) || (type === 'done' && item.done)) && <view class={`todo-item${item.done ? ' done' : ''}`}>
              <view class="toggle" data-id={item._id} bindtap={this.toggle}></view>
              <text >{item.text}</text>
              <view class="delete" data-id={item._id} bindtap={this.delete}></view>
            </view>
          ))}
        </view>

        <todo-footer onFilter={this.filter} onClear={this.clear} left={left} type={type} ></todo-footer>
      </view>
    )
  }
})
