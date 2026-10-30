package schema

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
)

// ===== 隐患管理（隐患台账 / 隐患类型 / 责任单位） =====

// HazardImageLimit 单条隐患每侧（整改前 / 整改后）最多 9 张图片。
const HazardImageLimit = 9

// HazardUnitRead 责任单位（单位与责任人一一对应）。
type HazardUnitRead struct {
	ID        int64         `json:"id"`
	Name      string        `json:"name"`
	Person    string        `json:"person"`
	Remark    *string       `json:"remark"`
	Enabled   bool          `json:"enabled"`
	CreatedAt jtype.UTCTime `json:"created_at"`
	UpdatedAt jtype.UTCTime `json:"updated_at"`
	Version   int64         `json:"version"`
}

func NewHazardUnitRead(u *model.HazardUnit) HazardUnitRead {
	return HazardUnitRead{ID: u.ID, Name: u.Name, Person: u.Person, Remark: u.Remark, Enabled: u.Enabled,
		CreatedAt: jtype.NewUTC(u.CreatedAt), UpdatedAt: jtype.NewUTC(u.UpdatedAt), Version: u.Version}
}

type HazardUnitCreate struct {
	Name    string  `json:"name" v:"required,min=1"`
	Person  string  `json:"person" v:"required,min=1"`
	Remark  *string `json:"remark" v:"max=255"`
	Enabled bool    `json:"enabled"`
}

// NewHazardUnitCreate 预填默认值（enabled=True）。
func NewHazardUnitCreate() HazardUnitCreate { return HazardUnitCreate{Enabled: true} }

type HazardUnitUpdate struct {
	Name    *string `json:"name" v:"min=1"`
	Person  *string `json:"person" v:"min=1"`
	Remark  *string `json:"remark" v:"max=255"`
	Enabled *bool   `json:"enabled"`
	Version int64   `json:"version" v:"required"`
}

// HazardTypeRead 隐患类型：一行一个「大类 + 小类」组合。
type HazardTypeRead struct {
	ID        int64         `json:"id"`
	Major     string        `json:"major"`
	Minor     string        `json:"minor"`
	CreatedAt jtype.UTCTime `json:"created_at"`
	UpdatedAt jtype.UTCTime `json:"updated_at"`
	Version   int64         `json:"version"`
}

func NewHazardTypeRead(t *model.HazardType) HazardTypeRead {
	return HazardTypeRead{ID: t.ID, Major: t.Major, Minor: t.Minor,
		CreatedAt: jtype.NewUTC(t.CreatedAt), UpdatedAt: jtype.NewUTC(t.UpdatedAt), Version: t.Version}
}

type HazardTypeCreate struct {
	Major string `json:"major" v:"required,min=1"`
	Minor string `json:"minor" v:"required,min=1"`
}

type HazardTypeUpdate struct {
	Major   *string `json:"major" v:"min=1"`
	Minor   *string `json:"minor" v:"min=1"`
	Version int64   `json:"version" v:"required"`
}

// HazardRead 隐患台账记录：含责任单位/类型名称快照与整改前/后图片。
type HazardRead struct {
	ID             int64            `json:"id"`
	InspectionArea string           `json:"inspection_area"`
	InspectionDate jtype.Date       `json:"inspection_date"`
	Inspector      string           `json:"inspector"`
	Description    string           `json:"description"`
	Suggestion     *string          `json:"suggestion"`
	HazardUnitID   int64            `json:"hazard_unit_id"`
	HazardUnitName string           `json:"hazard_unit_name"`
	Person         string           `json:"person"`
	DueDate        jtype.Date       `json:"due_date"`
	RecheckPerson  *string          `json:"recheck_person"`
	RectifyPerson  *string          `json:"rectify_person"`
	Status         string           `json:"status"`
	HazardTypeID   int64            `json:"hazard_type_id"`
	Major          string           `json:"major"`
	Minor          string           `json:"minor"`
	Level          string           `json:"level"`
	Remark         *string          `json:"remark"`
	BeforeImages   []FileObjectRead `json:"before_images"`
	AfterImages    []FileObjectRead `json:"after_images"`
	CreatedAt      jtype.UTCTime    `json:"created_at"`
	UpdatedAt      jtype.UTCTime    `json:"updated_at"`
	Version        int64            `json:"version"`
}

const (
	hazardStatusOneOf = "oneof=待整改|整改受阻|已整改"
	hazardLevelOneOf  = "oneof=一般隐患|重大隐患"
)

// HazardCreate 网页端登记隐患请求体。解码前请用 NewHazardCreate 预填默认值。
type HazardCreate struct {
	InspectionArea *string     `json:"inspection_area" v:"max=128"`
	InspectionDate *jtype.Date `json:"inspection_date"`
	Inspector      *string     `json:"inspector" v:"max=64"`
	Description    string      `json:"description" v:"required,min=1"`
	Suggestion     *string     `json:"suggestion" v:"max=2000"`
	HazardUnitID   int64       `json:"hazard_unit_id" v:"required"`
	DueDate        *jtype.Date `json:"due_date"`
	RecheckPerson  *string     `json:"recheck_person" v:"max=64"`
	RectifyPerson  *string     `json:"rectify_person" v:"max=64"`
	Status         string      `json:"status" v:"oneof=待整改|整改受阻|已整改"`
	HazardTypeID   int64       `json:"hazard_type_id" v:"required"`
	Level          string      `json:"level" v:"oneof=一般隐患|重大隐患"`
	Remark         *string     `json:"remark" v:"max=2000"`
	BeforeImageIDs []string    `json:"before_image_ids" v:"max=9,unique=image_ids,itempattern=uuid7"`
	AfterImageIDs  []string    `json:"after_image_ids" v:"max=9,unique=image_ids,itempattern=uuid7"`
}

// NewHazardCreate 预填 Python 模型里的默认值（状态待整改、一般隐患、图片为空）。
func NewHazardCreate() HazardCreate {
	return HazardCreate{
		Status:         domain.HazardStatusPending,
		Level:          domain.HazardLevelGeneral,
		BeforeImageIDs: []string{},
		AfterImageIDs:  []string{},
	}
}

type HazardUpdate struct {
	InspectionArea *string     `json:"inspection_area" v:"max=128"`
	InspectionDate *jtype.Date `json:"inspection_date"`
	Inspector      *string     `json:"inspector" v:"max=64"`
	Description    *string     `json:"description" v:"min=1"`
	Suggestion     *string     `json:"suggestion" v:"max=2000"`
	HazardUnitID   *int64      `json:"hazard_unit_id"`
	DueDate        *jtype.Date `json:"due_date"`
	RecheckPerson  *string     `json:"recheck_person" v:"max=64"`
	RectifyPerson  *string     `json:"rectify_person" v:"max=64"`
	Status         *string     `json:"status" v:"oneof=待整改|整改受阻|已整改"`
	HazardTypeID   *int64      `json:"hazard_type_id"`
	Level          *string     `json:"level" v:"oneof=一般隐患|重大隐患"`
	Remark         *string     `json:"remark" v:"max=2000"`
	BeforeImageIDs *[]string   `json:"before_image_ids" v:"max=9,unique=image_ids,itempattern=uuid7"`
	AfterImageIDs  *[]string   `json:"after_image_ids" v:"max=9,unique=image_ids,itempattern=uuid7"`
	Version        int64       `json:"version" v:"required"`
}

// HazardStatsRead 工作台隐患概览：三状态计数 + 逾期未整改数（今天到期不算逾期）。
type HazardStatsRead struct {
	Pending int64 `json:"pending"`
	Blocked int64 `json:"blocked"`
	Done    int64 `json:"done"`
	Overdue int64 `json:"overdue"`
}

// HazardFilterOptionsRead 隐患列表筛选项：整改员工由库中已有值去重得出。
type HazardFilterOptionsRead struct {
	RectifyPersons []string `json:"rectify_persons"`
}

// HazardFormOptionsRead 小程序登记隐患用的字典：启用的责任单位 + 全部隐患类型。
type HazardFormOptionsRead struct {
	Units []HazardUnitRead `json:"units"`
	Types []HazardTypeRead `json:"types"`
}

// MiniProgramHazardCreate 小程序登记隐患：在网页端请求体上增加幂等键（字段平铺，解码器不支持嵌入）。
// 解码前请用 NewMiniProgramHazardCreate 预填默认值。
type MiniProgramHazardCreate struct {
	InspectionArea  *string     `json:"inspection_area" v:"max=128"`
	InspectionDate  *jtype.Date `json:"inspection_date"`
	Inspector       *string     `json:"inspector" v:"max=64"`
	Description     string      `json:"description" v:"required,min=1"`
	Suggestion      *string     `json:"suggestion" v:"max=2000"`
	HazardUnitID    int64       `json:"hazard_unit_id" v:"required"`
	DueDate         *jtype.Date `json:"due_date"`
	RecheckPerson   *string     `json:"recheck_person" v:"max=64"`
	RectifyPerson   *string     `json:"rectify_person" v:"max=64"`
	Status          string      `json:"status" v:"oneof=待整改|整改受阻|已整改"`
	HazardTypeID    int64       `json:"hazard_type_id" v:"required"`
	Level           string      `json:"level" v:"oneof=一般隐患|重大隐患"`
	Remark          *string     `json:"remark" v:"max=2000"`
	BeforeImageIDs  []string    `json:"before_image_ids" v:"max=9,unique=image_ids,itempattern=uuid7"`
	AfterImageIDs   []string    `json:"after_image_ids" v:"max=9,unique=image_ids,itempattern=uuid7"`
	ClientRequestID string      `json:"client_request_id" v:"required,min=1,max=64"`
}

// NewMiniProgramHazardCreate 预填默认值（同 NewHazardCreate）。
func NewMiniProgramHazardCreate() MiniProgramHazardCreate {
	return MiniProgramHazardCreate{
		Status:         domain.HazardStatusPending,
		Level:          domain.HazardLevelGeneral,
		BeforeImageIDs: []string{},
		AfterImageIDs:  []string{},
	}
}

// Base 去掉幂等键，得到网页端同构的 HazardCreate。
func (m MiniProgramHazardCreate) Base() HazardCreate {
	return HazardCreate{
		InspectionArea: m.InspectionArea, InspectionDate: m.InspectionDate, Inspector: m.Inspector,
		Description: m.Description, Suggestion: m.Suggestion, HazardUnitID: m.HazardUnitID,
		DueDate: m.DueDate, RecheckPerson: m.RecheckPerson, RectifyPerson: m.RectifyPerson,
		Status: m.Status, HazardTypeID: m.HazardTypeID, Level: m.Level, Remark: m.Remark,
		BeforeImageIDs: m.BeforeImageIDs, AfterImageIDs: m.AfterImageIDs,
	}
}

// MiniProgramHazardUpdate 小程序跟进隐患：只开放整改闭环需要的字段。
type MiniProgramHazardUpdate struct {
	Status        *string   `json:"status" v:"oneof=待整改|整改受阻|已整改"`
	RectifyPerson *string   `json:"rectify_person" v:"max=64"`
	RecheckPerson *string   `json:"recheck_person" v:"max=64"`
	Remark        *string   `json:"remark" v:"max=2000"`
	AfterImageIDs *[]string `json:"after_image_ids" v:"max=9,unique=image_ids,itempattern=uuid7"`
	Version       int64     `json:"version" v:"required"`
}

// HazardStatusQuery / HazardLevelQuery 是枚举查询参数的校验标签。
const (
	HazardStatusQuery = hazardStatusOneOf
	HazardLevelQuery  = hazardLevelOneOf
)
