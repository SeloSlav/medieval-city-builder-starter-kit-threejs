#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash)]
pub enum ResidenceNeedKind {
    Firewood,
    Water,
}

impl ResidenceNeedKind {
    pub const ALL: [ResidenceNeedKind; 2] = [Self::Firewood, Self::Water];

    pub fn as_u8(self) -> u8 {
        match self {
            Self::Firewood => 0,
            Self::Water => 1,
        }
    }

    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(Self::Firewood),
            1 => Some(Self::Water),
            _ => None,
        }
    }
}
